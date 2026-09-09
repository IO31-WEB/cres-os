'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { updateDealStage } from '@/lib/actions/deals'
import { stagesFor } from '@/lib/pipelines'
import type { Deal } from '@/lib/db/schema'

const COLD_AFTER_DAYS = 7

interface DealCardProps {
  deal: Deal
  contactName?: string | null
}

export function DealCard({ deal, contactName }: DealCardProps) {
  const daysSinceActivity = Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / 86_400_000)
  const isCold = daysSinceActivity >= COLD_AFTER_DAYS && deal.status === 'open'

  return (
    <div className="rounded border border-border bg-surface p-3">
      <Link href={`/deals/${deal.id}`} className="text-sm font-medium text-ink hover:underline">
        {deal.name}
      </Link>
      {contactName && <p className="mt-0.5 text-xs text-ink-muted">{contactName}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {deal.value && <Badge variant="neutral">${Number(deal.value).toLocaleString()}</Badge>}
        {deal.ndaStatus !== 'not_applicable' && (
          <Badge variant={deal.ndaStatus === 'nda_signed' ? 'green' : 'amber'}>{deal.ndaStatus.replaceAll('_', ' ')}</Badge>
        )}
        {isCold && (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" /> {daysSinceActivity}d cold
          </span>
        )}
      </div>

      <Select
        className="mt-2 h-8 text-xs"
        value={deal.stage}
        onChange={(e) => updateDealStage(deal.id, deal.pipeline, e.target.value)}
        aria-label={`Move ${deal.name} to a different stage`}
      >
        {stagesFor(deal.pipeline).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </div>
  )
}
