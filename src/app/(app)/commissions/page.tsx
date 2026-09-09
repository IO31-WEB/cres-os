import Link from 'next/link'
import { DollarSign } from 'lucide-react'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { commissions, deals } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Card, CardContent } from '@/components/ui/card'

export default async function CommissionsPage() {
  const rows = await db
    .select({ commission: commissions, dealName: deals.name })
    .from(commissions)
    .leftJoin(deals, eq(commissions.dealId, deals.id))
    .orderBy(desc(commissions.createdAt))

  const totals = rows.reduce(
    (acc, { commission }) => {
      acc.expected += commission.expectedAmount
      if (commission.status === 'collected') acc.collected += commission.collectedAmount ?? commission.expectedAmount
      if (commission.status === 'overdue') acc.overdue += commission.expectedAmount
      return acc
    },
    { expected: 0, collected: 0, overdue: 0 }
  )

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-ink">Commissions</h2>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Total expected</p>
            <p className="text-lg font-semibold text-ink">${totals.expected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Collected</p>
            <p className="text-lg font-semibold text-emerald-600">${totals.collected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Overdue</p>
            <p className="text-lg font-semibold text-red-600">${totals.overdue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No commissions yet"
          description="Commissions are added from a deal's detail page once it's won or nearing close."
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ commission, dealName }) => (
            <Link
              key={commission.id}
              href={`/commissions/${commission.id}/edit`}
              className="flex items-center justify-between rounded border border-border p-3 hover:bg-surface"
            >
              <div>
                <p className="text-sm font-medium text-ink">{dealName ?? 'Unknown deal'}</p>
                <p className="text-xs text-ink-muted">
                  Expected ${commission.expectedAmount.toLocaleString()}
                  {commission.dueDate && ` · due ${new Date(commission.dueDate).toLocaleDateString()}`}
                </p>
              </div>
              <Badge variant={commission.status === 'collected' ? 'green' : commission.status === 'overdue' ? 'red' : 'neutral'}>
                {commission.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
