import { sql, eq, or, and, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals, dealCollaborators, commissions, documents, contacts, properties } from '@/lib/db/schema'
import { isOwner } from '@/lib/auth'
import type { User, Contact, Property, Deal, Commission, Document } from '@/lib/db/schema'

/**
 * Visibility model (V1):
 * - Owners see everything, always.
 * - Agents see contacts/properties/deals assigned to them.
 * - Unassigned records are visible to owners only, until an owner (or the
 *   creating agent, via auto-assignment on create) assigns them.
 * - Deals can additionally be shared with a specific helper agent via
 *   deal_collaborators — a deliberate per-deal add, not a team-wide toggle.
 * - Commissions and documents inherit visibility from the deal they belong
 *   to (or the contact/property they belong to, if not linked to a deal).
 *
 * Every function here returns `undefined` for owners, meaning "no filter" —
 * callers should spread it into `.where(...)` only when defined, e.g.
 * `db.select().from(contacts).where(contactsVisibleTo(user))`.
 */

export function contactsVisibleTo(user: User, contactsTable: { assignedToUserId: any }): SQL | undefined {
  if (isOwner(user)) return undefined
  return eq(contactsTable.assignedToUserId, user.id)
}

export function propertiesVisibleTo(user: User, propertiesTable: { assignedToUserId: any }): SQL | undefined {
  if (isOwner(user)) return undefined
  return eq(propertiesTable.assignedToUserId, user.id)
}

export function dealsVisibleTo(user: User): SQL | undefined {
  if (isOwner(user)) return undefined
  return or(
    eq(deals.assignedToUserId, user.id),
    sql`${deals.id} IN (SELECT ${dealCollaborators.dealId} FROM ${dealCollaborators} WHERE ${dealCollaborators.userId} = ${user.id})`
  )
}

/** Commissions have no assignee of their own — visibility follows the deal. */
export function commissionsVisibleTo(user: User): SQL | undefined {
  if (isOwner(user)) return undefined
  return sql`${commissions.dealId} IN (
    SELECT id FROM deals
    WHERE assigned_to_user_id = ${user.id}
       OR id IN (SELECT deal_id FROM deal_collaborators WHERE user_id = ${user.id})
  )`
}

/** Documents follow whichever parent (deal/contact/property) they're linked to. */
export function documentsVisibleTo(user: User): SQL | undefined {
  if (isOwner(user)) return undefined
  return or(
    sql`${documents.dealId} IN (
      SELECT id FROM deals
      WHERE assigned_to_user_id = ${user.id}
         OR id IN (SELECT deal_id FROM deal_collaborators WHERE user_id = ${user.id})
    )`,
    sql`${documents.contactId} IN (SELECT id FROM contacts WHERE assigned_to_user_id = ${user.id})`,
    sql`${documents.propertyId} IN (SELECT id FROM properties WHERE assigned_to_user_id = ${user.id})`
  )
}

// ── Single-record checks, for detail/edit pages and server actions ────────

export function canViewContact(user: User, contact: Contact): boolean {
  return isOwner(user) || contact.assignedToUserId === user.id
}

export function canViewProperty(user: User, property: Property): boolean {
  return isOwner(user) || property.assignedToUserId === user.id
}

export async function canViewDeal(user: User, deal: Deal): Promise<boolean> {
  if (isOwner(user)) return true
  if (deal.assignedToUserId === user.id) return true
  const [collab] = await db
    .select({ id: dealCollaborators.id })
    .from(dealCollaborators)
    .where(and(eq(dealCollaborators.dealId, deal.id), eq(dealCollaborators.userId, user.id)))
    .limit(1)
  return !!collab
}

export async function canViewCommission(user: User, commission: Commission): Promise<boolean> {
  if (isOwner(user)) return true
  const [deal] = await db.select().from(deals).where(eq(deals.id, commission.dealId)).limit(1)
  if (!deal) return false
  return canViewDeal(user, deal)
}

export async function canViewDocument(user: User, document: Document): Promise<boolean> {
  if (isOwner(user)) return true
  if (document.dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, document.dealId)).limit(1)
    if (deal && (await canViewDeal(user, deal))) return true
  }
  if (document.contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, document.contactId)).limit(1)
    if (contact && canViewContact(user, contact)) return true
  }
  if (document.propertyId) {
    const [property] = await db.select().from(properties).where(eq(properties.id, document.propertyId)).limit(1)
    if (property && canViewProperty(user, property)) return true
  }
  return false
}

/**
 * On create, an agent's own new record defaults to assigned-to-themselves
 * if they didn't pick someone else — otherwise it would be immediately
 * invisible to them (unassigned = owners-only). Owners can leave things
 * unassigned on purpose, so this only applies to agents.
 */
export function defaultAssignee(user: User, submittedAssigneeId: string | null): string | null {
  if (submittedAssigneeId) return submittedAssigneeId
  return isOwner(user) ? null : user.id
}
