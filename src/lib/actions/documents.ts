'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents, deals, contacts, properties } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { documentRecordSchema, type DOCUMENT_STATUSES } from '@/lib/validations/document'
import { parseForm, type ActionState } from '@/lib/actions/form-state'
import { canViewDeal, canViewContact, canViewProperty, canViewDocument } from '@/lib/visibility'
import { verifyUploadedObject, sanitizeFileName, deleteObject } from '@/lib/r2'

export async function createDocumentRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(documentRecordSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data

  // Verify access to whichever parent record this document is being
  // attached to, so an agent can't attach a document to a deal/contact/
  // property they can't otherwise see.
  if (d.dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, Number(d.dealId))).limit(1)
    if (!deal || !(await canViewDeal(user, deal))) notFound()
  }
  if (d.contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, Number(d.contactId))).limit(1)
    if (!contact || !canViewContact(user, contact)) notFound()
  }
  if (d.propertyId) {
    const [property] = await db.select().from(properties).where(eq(properties.id, Number(d.propertyId))).limit(1)
    if (!property || !canViewProperty(user, property)) notFound()
  }

  // The presigned PUT can't itself enforce a hard size/type cap, so verify
  // what actually landed in R2 before trusting it — reject and delete the
  // object if it doesn't match what was declared at presign time.
  const verification = await verifyUploadedObject(d.objectKey, d.contentType)
  if (!verification.ok) {
    return { errors: {}, message: verification.error }
  }

  await db.insert(documents).values({
    type: d.type,
    fileName: sanitizeFileName(d.fileName),
    objectKey: d.objectKey,
    fileSizeBytes: verification.sizeBytes,
    contentType: d.contentType,
    dealId: d.dealId ? Number(d.dealId) : null,
    contactId: d.contactId ? Number(d.contactId) : null,
    propertyId: d.propertyId ? Number(d.propertyId) : null,
    uploadedByUserId: user.id,
    status: 'draft',
  })

  revalidatePath('/documents')
  if (d.dealId) revalidatePath(`/deals/${d.dealId}`)
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

  revalidatePath('/documents')
  if (doc.dealId) revalidatePath(`/deals/${doc.dealId}`)
}
