import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { FileBarChart, Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { scorecardAnalyses } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

function gradeVariant(grade: string): 'green' | 'blue' | 'amber' | 'red' {
  if (grade.startsWith('A')) return 'green'
  if (grade.startsWith('B')) return 'blue'
  if (grade.startsWith('C')) return 'amber'
  return 'red'
}

export async function ScorecardHistory({ propertyId }: { propertyId: number }) {
  const rows = await db
    .select()
    .from(scorecardAnalyses)
    .where(eq(scorecardAnalyses.propertyId, propertyId))
    .orderBy(desc(scorecardAnalyses.createdAt))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">Scorecard history</h3>
        <Button asChild size="sm" variant="outline">
          <Link href={`/scorecard?propertyId=${propertyId}`}>
            <Plus className="h-4 w-4" /> Run scorecard
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No scorecard analyses yet"
          description="Run a Site Quality Scorecard for this property to see it here, with every past run kept for comparison."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/scorecard/${r.id}`}
                className="flex items-center justify-between rounded border border-border p-3 hover:bg-surface"
              >
                <div>
                  <p className="text-sm text-ink">{r.businessProfile.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-ink-muted">{r.createdAt.toLocaleDateString()}</p>
                </div>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    { green: 'bg-emerald-500/10 text-emerald-700', blue: 'bg-blue-500/10 text-blue-700', amber: 'bg-amber-500/10 text-amber-700', red: 'bg-red-500/10 text-red-700' }[
                      gradeVariant(r.overallGrade)
                    ]
                  }`}
                >
                  {r.overallGrade}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
