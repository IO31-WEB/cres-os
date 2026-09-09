import { CATEGORY_LABELS, type GradeWeights } from '@/lib/grader-types'
import { BUSINESS_PROFILE_LIST, type BusinessProfileId } from '@/lib/business-profiles'

export interface ScoreReportData {
  reportId: number
  cached?: boolean
  formattedAddress: string
  businessProfile: BusinessProfileId
  overallScore: number
  overallGrade: string
  categoryScores: Record<keyof GradeWeights, number>
  narrative: { summary: string; strengths: string[]; risks: string[]; recommendation: string } | null
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
  if (grade.startsWith('B')) return 'text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400'
  if (grade.startsWith('C')) return 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400'
  if (grade.startsWith('D')) return 'text-orange-700 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400'
  return 'text-red-700 bg-red-50 dark:bg-red-500/10 dark:text-red-400'
}

export function ScoreReport({ result }: { result: ScoreReportData }) {
  return (
    <div className="rounded border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-ink-muted">{result.formattedAddress}</div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gold-dim">
            Scored for: {BUSINESS_PROFILE_LIST.find((p) => p.id === result.businessProfile)?.label ?? result.businessProfile}
          </div>
          {result.cached && <div className="mt-0.5 text-xs text-ink-muted">Loaded from cache</div>}
        </div>
        <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${gradeColor(result.overallGrade)}`}>
          {result.overallGrade}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {(Object.keys(result.categoryScores) as Array<keyof GradeWeights>).map((key) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <div className="w-44 text-ink-muted">{CATEGORY_LABELS[key]}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-navy" style={{ width: `${result.categoryScores[key]}%` }} />
            </div>
            <div className="w-8 text-right font-medium text-ink">{result.categoryScores[key].toFixed(0)}</div>
          </div>
        ))}
      </div>

      {result.narrative && <p className="mt-6 text-sm leading-relaxed text-ink">{result.narrative.summary}</p>}

      <a
        href={`/api/report/${result.reportId}/pdf`}
        className="mt-6 inline-block rounded bg-gold px-5 py-2.5 text-sm font-medium text-navy hover:opacity-90"
      >
        Download PDF Report
      </a>
    </div>
  )
}
