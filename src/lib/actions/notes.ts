'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notes, deals, contacts, properties } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { canViewContact, canViewProperty, canViewDeal } from '@/lib/visibility'

interface AddNoteParams {
  content: string
  contactId?: number
  dealId?: number
  propertyId?: number
  revalidate: string
}

export async function addNote({ content, contactId, dealId, propertyId, revalidate }: AddNoteParams) {
  const user = await requireUser()
  if (!content.trim()) return

  // Never trust a client-supplied contactId/dealId/propertyId — this was
  // previously unchecked, letting any authenticated user attach a note to
  // any contact/deal/property regardless of assignment (an IDOR: notes are
  // otherwise-invisible activity, so the only signal was "did the request
  // succeed").
  if (contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact || !canViewContact(user, contact)) throw new Error('Contact not found')
  }
  if (dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
    if (!deal || !(await canViewDeal(user, deal))) throw new Error('Deal not found')
  }
  if (propertyId) {
    const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
    if (!property || !canViewProperty(user, property)) throw new Error('Property not found')
  }

  await db.insert(notes).values({
    content: content.trim(),
    contactId: contactId ?? null,
    dealId: dealId ?? null,
    propertyId: propertyId ?? null,
    authorUserId: user.id,
  })

  // A logged call/email/note is activity — keeps "deals going cold" honest.
  if (dealId) {
    await db.update(deals).set({ lastActivityAt: new Date() }).where(eq(deals.id, dealId))
  }

  revalidatePath(revalidate)
}
