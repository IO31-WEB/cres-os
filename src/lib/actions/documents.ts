'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents, deals } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { documentRecordSchema, type DOCUMENT_STATUSES } from '@/lib/validations/document'
import { parseForm, type ActionState } from '@/lib/actions/form-state'

export async function createDocumentRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(documentRecordSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  await db.insert(documents).values({
    type: d.type,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
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
  await requireUser()

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  if (!doc) return

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
  await requireUser()
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  await db.delete(documents).where(eq(documents.id, documentId))
  revalidatePath('/documents')
  if (doc?.dealId) revalidatePath(`/deals/${doc.dealId}`)
}
