import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { scorecardAnalyses, properties } from '@/lib/db/schema'
import { ScoreReport, type ScoreReportData } from '@/components/scorecard/score-report'
import type { GradeWeights } from '@/lib/grader-types'
import type { BusinessProfileId } from '@/lib/business-profiles'
import { requireUser } from '@/lib/auth'
import { canViewScorecard } from '@/lib/visibility'

export default async function ScorecardReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const reportId = Number(id)
  if (Number.isNaN(reportId)) notFound()

  const user = await requireUser()
  const [report] = await db.select().from(scorecardAnalyses).where(eq(scorecardAnalyses.id, reportId)).limit(1)
  if (!report || !(await canViewScorecard(user, report))) notFound()

  const property = report.propertyId
    ? (await db.select().from(properties).where(eq(properties.id, report.propertyId)).limit(1))[0]
    : undefined

  const result: ScoreReportData = {
    reportId: report.id,
    formattedAddress: report.formattedAddress,
    businessProfile: report.businessProfile as BusinessProfileId,
    overallScore: report.overallScore,
    overallGrade: report.overallGrade,
    categoryScores: report.categoryScores as Record<keyof GradeWeights, number>,
    narrative: report.narrative as ScoreReportData['narrative'],
  }

  return (
    <div className="max-w-2xl">
      {property && (
        <Link href={`/properties/${property.id}`} className="mb-4 inline-block text-sm text-navy hover:underline dark:text-white">
          ← Back to {property.formattedAddress}
        </Link>
      )}
      <ScoreReport result={result} />
    </div>
  )
}
