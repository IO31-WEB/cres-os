import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { dismissPriority } from '@/lib/actions/priorities'
import { DraftMessageBox } from '@/components/dashboard/draft-message-box'
import type { DailyPriority } from '@/lib/db/schema'

interface PriorityCardProps {
  priority: DailyPriority
  title: string
  href: string
}

export function PriorityCard({ priority, title, href }: PriorityCardProps) {
  const boundDismiss = dismissPriority.bind(null, priority.id)

  return (
    <div className="rounded border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="text-sm font-medium text-ink hover:underline">
          {title}
        </Link>
        <form action={boundDismiss}>
          <Button type="submit" variant="ghost" size="icon" className="h-6 w-6" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{priority.reason}</p>
      {priority.draftMessage && <DraftMessageBox message={priority.draftMessage} />}
    </div>
  )
}
