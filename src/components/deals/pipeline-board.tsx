import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals, contacts } from '@/lib/db/schema'
import { stagesFor, type PipelineId } from '@/lib/pipelines'
import { DealCard } from '@/components/deals/deal-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Handshake } from 'lucide-react'

export async function PipelineBoard({ pipeline }: { pipeline: PipelineId }) {
  const rows = await db
    .select({ deal: deals, contactFirstName: contacts.firstName, contactLastName: contacts.lastName })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .where(and(eq(deals.pipeline, pipeline), eq(deals.status, 'open')))

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="No open deals in this pipeline"
        description="Create a deal to start tracking it through this pipeline's stages."
        actionHref="/deals/new"
        actionLabel="New deal"
      />
    )
  }

  const stages = stagesFor(pipeline)

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageDeals = rows.filter((r) => r.deal.stage === stage)
        return (
          <div key={stage} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{stage}</h3>
              <span className="text-xs text-ink-muted">{stageDeals.length}</span>
            </div>
            <div className="space-y-2">
              {stageDeals.map(({ deal, contactFirstName, contactLastName }) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  contactName={contactFirstName ? `${contactFirstName} ${contactLastName ?? ''}`.trim() : null}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
