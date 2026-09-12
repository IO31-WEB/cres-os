import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts, companies, properties, deals } from '@/lib/db/schema'
import { canViewContact, canViewCompany, canViewProperty, canViewDeal } from '@/lib/visibility'
import type { User } from '@/lib/db/schema'

/**
 * Never trust a client-supplied foreign key. Whenever a form/action accepts
 * a related record id (contactId, companyId, propertyId, dealId, ...), run
 * it through the matching one of these before writing it — this is the
 * IDOR/BOLA guard for cross-record linking (creating a deal with someone
 * else's contactId, attaching a note to a property you can't see, etc).
 *
 * All return `null` for "ok to link" (including `id === null`, meaning "no
 * link requested") or a user-facing error string otherwise. Not found and
 * not authorized both produce the same generic error, so probing for
 * existence isn't distinguishable from probing for access.
 */

export async function assertContactLinkable(user: User, contactId: number | null): Promise<string | null> {
  if (contactId === null) return null
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact || !canViewContact(user, contact)) return 'The selected contact could not be found.'
  return null
}

export async function assertCompanyLinkable(user: User, companyId: number | null): Promise<string | null> {
  if (companyId === null) return null
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company || !canViewCompany(user, company)) return 'The selected company could not be found.'
  return null
}

export async function assertPropertyLinkable(user: User, propertyId: number | null): Promise<string | null> {
  if (propertyId === null) return null
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1)
  if (!property || !canViewProperty(user, property)) return 'The selected property could not be found.'
  return null
}

export async function assertDealLinkable(user: User, dealId: number | null): Promise<string | null> {
  if (dealId === null) return null
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!deal || !(await canViewDeal(user, deal))) return 'The selected deal could not be found.'
  return null
}

/**
 * If the requesting user is an agent (not an owner), verify a submitted
 * assignedToUserId actually refers to an existing user before it's
 * written — otherwise a typo'd/garbage id just surfaces as an opaque FK
 * violation later. Owners get the same courtesy for a friendlier error,
 * even though they're allowed to assign to anyone.
 */
export async function assertUserExists(userId: string | null): Promise<string | null> {
  if (userId === null) return null
  const { users } = await import('@/lib/db/schema')
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!target) return 'The selected user could not be found.'
  return null
}
