'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents, deals, contacts, properties, pendingUploads } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { documentRecordSchema, type DOCUMENT_STATUSES } from '@/lib/validations/document'
import { parseForm, fieldError, type ActionState } from '@/lib/actions/form-state'
import { canViewDeal, canViewContact, canViewProperty, canViewDocument } from '@/lib/visibility'
import { verifyUploadedObject, sanitizeFileName, deleteObject } from '@/lib/r2'
import { logAuditBestEffort } from '@/lib/audit'

export async function createDocumentRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(documentRecordSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const dealId = d.dealId ? Number(d.dealId) : null
  const contactId = d.contactId ? Number(d.contactId) : null
  const propertyId = d.propertyId ? Number(d.propertyId) : null

  // Verify access to whichever parent record this document is being
  // attached to, so an agent can't attach a document to a deal/contact/
  // property they can't otherwise see.
  if (dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
    if (!deal || !(await canViewDeal(user, deal))) notFound()
  }
  if (contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact || !canViewContact(user, contact)) notFound()
  }
  if (propertyId) {
    const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
    if (!property || !canViewProperty(user, property)) notFound()
  }

  // The object key, content type, and size are never taken from this form
  // directly — they come from the pending_uploads row created by the
  // presign step (api/documents/upload-url), which is the only place those
  // values are ever decided server-side. This is what stops a client from
  // submitting an arbitrary/guessed/reused object key: without a matching
  // pending row owned by this exact user, in 'pending' status, and not
  // expired, there's nothing for this form to finalize.
  const [pending] = await db
    .select()
    .from(pendingUploads)
    .where(eq(pendingUploads.id, d.pendingUploadId))
    .limit(1)

  if (!pending || pending.userId !== user.id) {
    return fieldError('pendingUploadId', 'That upload session was not found. Please choose the file again.')
  }
  if (pending.status !== 'pending') {
    return fieldError('pendingUploadId', 'That upload has already been used or has expired. Please choose the file again.')
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    await db.update(pendingUploads).set({ status: 'expired' }).where(eq(pendingUploads.id, pending.id))
    return fieldError('pendingUploadId', 'That upload session expired. Please choose the file again.')
  }
  // The parent entity chosen when finalizing must match what was declared
  // at presign time (defense in depth — the presign step already checked
  // access to it, so this also re-checks nothing changed in between).
  if (pending.dealId !== dealId || pending.contactId !== contactId || pending.propertyId !== propertyId) {
    return fieldError('pendingUploadId', 'That upload was prepared for a different record.')
  }

  // The presigned PUT can't itself enforce a hard size/type cap, so verify
  // what actually landed in R2 before trusting it — reject and delete the
  // object if it doesn't match what was declared at presign time.
  const verification = await verifyUploadedObject(pending.objectKey, pending.declaredContentType)
  if (!verification.ok) {
    return fieldError('pendingUploadId', verification.error)
  }

  const [created] = await db
    .insert(documents)
    .values({
      type: d.type,
      fileName: sanitizeFileName(d.fileName || pending.declaredFileName),
      objectKey: pending.objectKey,
      fileSizeBytes: verification.sizeBytes,
      contentType: pending.declaredContentType,
      dealId,
      contactId,
      propertyId,
      uploadedByUserId: user.id,
      status: 'draft',
    })
    .returning({ id: documents.id })

  await db
    .update(pendingUploads)
    .set({ status: 'finalized', finalizedAt: new Date() })
    .where(eq(pendingUploads.id, pending.id))

  await logAuditBestEffort({
    user,
    action: 'document.upload',
    entityType: 'document',
    entityId: created.id,
    metadata: { fileName: sanitizeFileName(d.fileName || pending.declaredFileName), dealId, contactId, propertyId },
  })

  revalidatePath('/documents')
  if (dealId) revalidatePath(`/deals/${dealId}`)
  redirect('/documents')
}

export async function setDocumentStatus(documentId: number, status: (typeof DOCUMENT_STATUSES)[number]): Promise<void> {
  const user = await requireUser()

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  if (!doc || !(await canViewDocument(user, doc))) notFound()

  const timestamps: Record<string, Date> = {}
  if (status === 'sent') timestamps.sentAt = new Date()
  if (status === 'signed') timestamps.signedAt = new Date()

  await db.update(documents).set({ status, ...timestamps }).where(eq(documents.id, documentId))

  // NDA signed on a deal's document unlocks confidential info for that deal —
  // reflect it on the deal record so the "why" is visible without re-deriving
  // it from the documents table every time the deal loads.
  if (doc.type === 'nda' && status === 'signed' && doc.dealId) {
    await db
      .update(deals)
      .set({ ndaStatus: 'nda_signed', lastActivityAt: new Date() })
      .where(and(eq(deals.id, doc.dealId)))
  }

  await logAuditBestEffort({ user, action: 'document.status_change', entityType: 'document', entityId: documentId, metadata: { status } })

  revalidatePath('/documents')
  if (doc.dealId) revalidatePath(`/deals/${doc.dealId}`)
}

export async function deleteDocument(documentId: number): Promise<void> {
  const user = await requireUser()
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  if (!doc || !(await canViewDocument(user, doc))) notFound()

  await db.delete(documents).where(eq(documents.id, documentId))
  await deleteObject(doc.objectKey).catch(() => {
    // Best-effort — an orphaned R2 object with an unpredictable key and no
    // DB row pointing at it is inert; not worth failing the delete over.
  })

  await logAuditBestEffort({ user, action: 'document.delete', entityType: 'document', entityId: documentId, metadata: { fileName: doc.fileName } })

  revalidatePath('/documents')
  if (doc.dealId) revalidatePath(`/deals/${doc.dealId}`)
}
