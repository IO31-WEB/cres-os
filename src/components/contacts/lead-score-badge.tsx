import { Badge } from '@/components/ui/badge'
import type { LEAD_SCORES } from '@/lib/validations/contact'

const VARIANT: Record<(typeof LEAD_SCORES)[number], 'red' | 'amber' | 'blue' | 'neutral'> = {
  hot: 'red',
  warm: 'amber',
  nurture: 'blue',
  unqualified: 'neutral',
}

const LABEL: Record<(typeof LEAD_SCORES)[number], string> = {
  hot: 'Hot',
  warm: 'Warm',
  nurture: 'Nurture',
  unqualified: 'Unqualified',
}

export function LeadScoreBadge({ score }: { score: (typeof LEAD_SCORES)[number] | string }) {
  const key = score as (typeof LEAD_SCORES)[number]
  return <Badge variant={VARIANT[key] ?? 'neutral'}>{LABEL[key] ?? score}</Badge>
}
