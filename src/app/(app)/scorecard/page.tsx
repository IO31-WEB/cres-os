import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq, and } from 'drizzle-orm'
import { FileBarChart } from 'lucide-react'
import { db } from '@/lib/db'
import { properties, scorecardAnalyses } from '@/lib/db/schema'
import { ScorecardLauncher } from '@/components/scorecard/scorecard-launcher'
import { EmptyState } from '@/components/ui/empty-state'
import type { BusinessProfileId } from '@/lib/business-profiles'
import { requireUser } from '@/lib/auth'
import { canViewProperty, scorecardsVisibleTo } from '@/lib/visibility'

function gradeVariant(grade: string): string {
  if (grade.startsWith('A')) return 'bg-emerald-500/10 text-emerald-700'
  if (grade.startsWith('B')) return 'bg-blue-500/10 text-blue-700'
  if (grade.startsWith('C')) return 'bg-amber-500/10 text-amber-700'
  return 'bg-red-500/10 text-red-700'
}

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>
}) {
  const { propertyId } = await searchParams
  const id = propertyId ? Number(propertyId) : undefined
  const user = await requireUser()

  let property
  if (id) {
    const [row] = await db.select().from(properties).where(eq(properties.id, id)).limit(1)
    if (!row || !canViewProperty(user, row)) notFound()
    property = row
  }

  // Recent history — scoped to this property if launched from one,
  // otherwise every analysis this user can see (owners: firm-wide; agents:
  // only what's tied to their own properties/deals, or that they ran
  // standalone themselves).
  const visibility = scorecardsVisibleTo(user)
  const recent = property
    ? await db
        .select()
        .from(scorecardAnalyses)
        .where(eq(scorecardAnalyses.propertyId, property.id))
        .orderBy(desc(scorecardAnalyses.createdAt))
        .limit(20)
    : await db.select().from(scorecardAnalyses).where(visibility).orderBy(desc(scorecardAnalyses.createdAt)).limit(20)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink">Site Quality Scorecard</h2>
          <p className="text-sm text-ink-muted">
            {property
              ? `Running a new analysis for ${property.formattedAddress}.`
              : 'Enter a Florida commercial address to generate a scored analysis and PDF report.'}
          </p>
        </div>
        <ScorecardLauncher
          propertyId={property?.id}
          defaultAddress={property?.formattedAddress}
          defaultBusinessProfile={property?.defaultBusinessProfile as BusinessProfileId | undefined}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-ink">
          {property ? 'History for this property' : 'Recent analyses'}
        </h3>
        {recent.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No analyses yet" description="Runs will show up here as you go." />
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/scorecard/${r.id}`}
                  className="flex items-center justify-between rounded border border-border p-3 text-sm hover:bg-surface"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink">{r.formattedAddress}</p>
                    <p className="text-xs text-ink-muted">{r.createdAt.toLocaleDateString()}</p>
                  </div>
                  <span className={`ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${gradeVariant(r.overallGrade)}`}>
                    {r.overallGrade}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
