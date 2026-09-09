import Link from 'next/link'
import { PIPELINES, PIPELINE_IDS, type PipelineId } from '@/lib/pipelines'

export function PipelineTabs({ active }: { active: PipelineId }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {PIPELINE_IDS.map((p) => (
        <Link
          key={p}
          href={`/deals?pipeline=${p}`}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            active === p ? 'bg-navy text-white' : 'border border-border bg-surface text-ink-muted'
          }`}
        >
          {PIPELINES[p].label}
        </Link>
      ))}
    </div>
  )
}
