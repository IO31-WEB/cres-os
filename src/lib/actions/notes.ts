'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notes, deals } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'

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
