import { or, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import type { Contact } from '@/lib/db/schema'

/**
 * Matches an inbound lead to an existing contact by email or phone, since
 * the same person often reaches out through more than one channel (web
 * form, then a follow-up email) and shouldn't fork into duplicate records.
 */
export async function findExistingContact(email?: string | null, phone?: string | null): Promise<Contact | null> {
  if (!email && !phone) return null

  const conditions = []
  if (email) conditions.push(eq(contacts.email, email))
  if (phone) conditions.push(eq(contacts.phone, phone))

  const [match] = await db
    .select()
    .from(contacts)
    .where(or(...conditions))
    .limit(1)

  return match ?? null
}
