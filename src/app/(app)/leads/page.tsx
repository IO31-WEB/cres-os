import { desc, ne } from 'drizzle-orm'
import { Inbox } from 'lucide-react'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { leadIntakes } from '@/lib/db/schema'
import { EmptyState } from '@/components/ui/empty-state'
import { requireUser, isOwner } from '@/lib/auth'
import { RetryClassificationButton } from '@/components/leads/retry-classification-button'
import type { LeadIntakePayload } from '@/lib/validations/lead-intake'

export default async function PendingLeadsPage() {
  const user = await requireUser()
  // Pending leads are unassigned by definition — same owners-only rule as
  // any other unassigned record — so agents never land here at all.
  if (!isOwner(user)) notFound()
  const rows = await db
    .select()
    .from(leadIntakes)
    .where(ne(leadIntakes.status, 'converted'))
    .orderBy(desc(leadIntakes.createdAt))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">Pending leads</h2>
        <p className="text-sm text-ink-muted">Inbound messages that haven't been classified into a contact yet.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing pending"
          description="Every inbound lead has been classified and converted into a contact."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((intake) => {
            const payload = intake.rawPayload as LeadIntakePayload
            const errorInfo = intake.aiClassification as { error?: string } | null

            return (
              <li key={intake.id} className="rounded border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{payload.name}</p>
                    <p className="text-xs text-ink-muted">
                      {intake.source} · {intake.createdAt.toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm text-ink-muted">{payload.message}</p>
                    {errorInfo?.error && (
                      <p className="mt-2 text-xs text-red-600">Classification failed: {errorInfo.error}</p>
                    )}
                  </div>
                  <RetryClassificationButton leadIntakeId={intake.id} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
