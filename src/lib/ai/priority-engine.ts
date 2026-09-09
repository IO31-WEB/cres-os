import { and, eq, or, isNull, lt, lte, gte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, contacts, deals, documents, commissions } from '@/lib/db/schema'
import { dailyPriorities } from '@/lib/db/schema'
import { draftReengagement } from '@/lib/ai/reengagement-drafts'

const COLD_AFTER_DAYS = 7
const HOT_STALE_DAYS = 2
const WARM_STALE_DAYS = 3
const NDA_STALE_DAYS = 3
const COMMISSION_DUE_SOON_DAYS = 3
const ANNIVERSARY_LOOKAHEAD_DAYS = 14

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000)
}

function isWithinAnniversaryWindow(anniversary: Date, lookaheadDays: number): boolean {
  const now = new Date()
  const thisYear = new Date(now.getFullYear(), anniversary.getMonth(), anniversary.getDate())
  const diffDays = Math.floor((thisYear.getTime() - now.getTime()) / 86_400_000)
  return diffDays >= 0 && diffDays <= lookaheadDays
}

interface PriorityDraft {
  forUserId: string
  category:
    | 'hot_opportunity'
    | 'call_today'
    | 'deal_going_cold'
    | 'nda_outstanding'
    | 'commission_due'
    | 'past_client_followup'
  reason: string
  contactId?: number
  dealId?: number
  documentId?: number
  commissionId?: number
  draftMessage?: string
}

/**
 * Builds and persists today's priorities for every user. Idempotent —
 * relies on the (forUserId, day, category, contactId, dealId) unique index
 * so re-running mid-day (e.g. a retried cron invocation) doesn't duplicate
 * cards, it just leaves the existing ones alone.
 */
export async function generateDailyPriorities(): Promise<number> {
  const allUsers = await db.select().from(users)
  const owners = allUsers.filter((u) => u.role === 'owner')
  const drafts: PriorityDraft[] = []

  // Assigned-or-unassigned-to-owner helper: an item assigned to a specific
  // user shows for that user; an unassigned item shows for every owner, so
  // nothing falls through the cracks before someone claims it.
  function audienceFor(assignedToUserId: string | null): string[] {
    if (assignedToUserId) return [assignedToUserId]
    return owners.map((o) => o.id)
  }

  // 1. Hot opportunities — hot leads gone quiet for a couple of days
  const hotContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.leadScore, 'hot'),
        or(isNull(contacts.lastContactedAt), lt(contacts.lastContactedAt, daysAgo(HOT_STALE_DAYS)))
      )
    )
  for (const contact of hotContacts) {
    for (const userId of audienceFor(contact.assignedToUserId)) {
      drafts.push({
        forUserId: userId,
        category: 'hot_opportunity',
        contactId: contact.id,
        reason: contact.leadScoreReason
          ? `Hot lead, ${contact.leadScoreReason.toLowerCase()}`
          : `Hot lead hasn't been contacted in ${HOT_STALE_DAYS}+ days`,
      })
    }
  }

  // 2. Warm leads worth a call today
  const warmContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.leadScore, 'warm'),
        or(isNull(contacts.lastContactedAt), lt(contacts.lastContactedAt, daysAgo(WARM_STALE_DAYS)))
      )
    )
  for (const contact of warmContacts) {
    for (const userId of audienceFor(contact.assignedToUserId)) {
      drafts.push({
        forUserId: userId,
        category: 'call_today',
        contactId: contact.id,
        reason: `Warm lead, no contact in ${WARM_STALE_DAYS}+ days`,
      })
    }
  }

  // 3. Deals going cold — with an AI-drafted re-engagement message
  const openDeals = await db
    .select()
    .from(deals)
    .where(and(eq(deals.status, 'open'), lt(deals.lastActivityAt, daysAgo(COLD_AFTER_DAYS))))
  for (const deal of openDeals) {
    const daysCold = Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / 86_400_000)
    const draftMessage = await draftReengagement(deal).catch(() => undefined)
    for (const userId of audienceFor(deal.assignedToUserId)) {
      drafts.push({
        forUserId: userId,
        category: 'deal_going_cold',
        dealId: deal.id,
        reason: `No activity in ${daysCold} days — ${deal.stage}`,
        draftMessage,
      })
    }
  }

  // 4. Outstanding NDAs — sent or viewed but not signed
  const staleDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.type, 'nda'),
        or(eq(documents.status, 'sent'), eq(documents.status, 'viewed')),
        or(lt(documents.sentAt, daysAgo(NDA_STALE_DAYS)), isNull(documents.sentAt))
      )
    )
  for (const doc of staleDocs) {
    const deal = doc.dealId ? await db.select().from(deals).where(eq(deals.id, doc.dealId)).limit(1) : []
    const assignedTo = deal[0]?.assignedToUserId ?? null
    for (const userId of audienceFor(assignedTo)) {
      drafts.push({
        forUserId: userId,
        category: 'nda_outstanding',
        documentId: doc.id,
        dealId: doc.dealId ?? undefined,
        reason: `NDA ${doc.status} but not signed`,
      })
    }
  }

  // 5. Commissions due or overdue
  const dueCommissions = await db
    .select()
    .from(commissions)
    .where(
      and(
        ne(commissions.status, 'collected'),
        or(eq(commissions.status, 'overdue'), lte(commissions.dueDate, daysFromNow(COMMISSION_DUE_SOON_DAYS)))
      )
    )
  for (const commission of dueCommissions) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, commission.dealId)).limit(1)
    for (const userId of audienceFor(deal?.assignedToUserId ?? null)) {
      drafts.push({
        forUserId: userId,
        category: 'commission_due',
        commissionId: commission.id,
        dealId: commission.dealId,
        reason:
          commission.status === 'overdue'
            ? `Overdue — $${commission.expectedAmount.toLocaleString()}`
            : `Due soon — $${commission.expectedAmount.toLocaleString()}`,
      })
    }
  }

  // 6. Past-client anniversaries — relationship-maintenance nudge
  const pastClients = await db.select().from(contacts).where(eq(contacts.contactType, 'past_client'))
  for (const contact of pastClients) {
    if (!contact.anniversaryDate) continue
    if (!isWithinAnniversaryWindow(new Date(contact.anniversaryDate), ANNIVERSARY_LOOKAHEAD_DAYS)) continue
    for (const userId of audienceFor(contact.assignedToUserId)) {
      drafts.push({
        forUserId: userId,
        category: 'past_client_followup',
        contactId: contact.id,
        reason: 'Anniversary coming up — good moment to reconnect',
      })
    }
  }

  if (drafts.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)

  await db
    .insert(dailyPriorities)
    .values(
      drafts.map((d) => ({
        forUserId: d.forUserId,
        day: today,
        category: d.category,
        reason: d.reason,
        contactId: d.contactId ?? null,
        dealId: d.dealId ?? null,
        documentId: d.documentId ?? null,
        commissionId: d.commissionId ?? null,
        draftMessage: d.draftMessage ?? null,
      }))
    )
    .onConflictDoNothing()

  return drafts.length
}
