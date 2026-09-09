import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyPriorities, contacts, deals, commissions } from '@/lib/db/schema'
import { PriorityCard } from '@/components/dashboard/priority-card'
import type { DailyPriority } from '@/lib/db/schema'

const CATEGORY_LABELS: Record<string, string> = {
  hot_opportunity: 'Hot opportunities',
  call_today: 'Call today',
  deal_going_cold: 'Deals going cold',
  nda_outstanding: 'Outstanding NDAs',
  commission_due: 'Commissions due',
  past_client_followup: 'Past clients to reconnect with',
}

const CATEGORY_ORDER = [
  'hot_opportunity',
  'call_today',
  'deal_going_cold',
  'nda_outstanding',
  'commission_due',
  'past_client_followup',
]

async function resolveTitleAndHref(priority: DailyPriority): Promise<{ title: string; href: string } | null> {
  if (priority.commissionId) {
    const [commission] = await db.select().from(commissions).where(eq(commissions.id, priority.commissionId)).limit(1)
    if (!commission) return null
    const [deal] = await db.select().from(deals).where(eq(deals.id, commission.dealId)).limit(1)
    return { title: `Commission — ${deal?.name ?? 'deal'}`, href: `/commissions/${commission.id}/edit` }
  }
  if (priority.documentId && priority.dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, priority.dealId)).limit(1)
    if (!deal) return null
    return { title: `NDA — ${deal.name}`, href: `/deals/${deal.id}` }
  }
  if (priority.dealId) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, priority.dealId)).limit(1)
    if (!deal) return null
    return { title: deal.name, href: `/deals/${deal.id}` }
  }
  if (priority.contactId) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, priority.contactId)).limit(1)
    if (!contact) return null
    return { title: `${contact.firstName} ${contact.lastName ?? ''}`.trim(), href: `/contacts/${contact.id}` }
  }
  return null
}

export async function PriorityList({ userId }: { userId: string }) {
  const today = new Date().toISOString().slice(0, 10)

  const rows = await db
    .select()
    .from(dailyPriorities)
    .where(and(eq(dailyPriorities.forUserId, userId), eq(dailyPriorities.day, today), eq(dailyPriorities.dismissed, false)))

  if (rows.length === 0) return null

  const grouped = new Map<string, DailyPriority[]>()
  for (const row of rows) {
    grouped.set(row.category, [...(grouped.get(row.category) ?? []), row])
  }

  const sections = await Promise.all(
    CATEGORY_ORDER.filter((c) => grouped.has(c)).map(async (category) => {
      const items = await Promise.all(
        grouped.get(category)!.map(async (priority) => ({
          priority,
          resolved: await resolveTitleAndHref(priority),
        }))
      )
      return { category, items: items.filter((i) => i.resolved) }
    })
  )

  return (
    <div className="space-y-6">
      {sections.map(({ category, items }) =>
        items.length === 0 ? null : (
          <div key={category}>
            <h3 className="mb-2 text-sm font-medium text-ink">{CATEGORY_LABELS[category]}</h3>
            <div className="space-y-2">
              {items.map(({ priority, resolved }) => (
                <PriorityCard key={priority.id} priority={priority} title={resolved!.title} href={resolved!.href} />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
