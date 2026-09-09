import { Sparkles } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { PriorityList } from '@/components/dashboard/priority-list'

export default async function DashboardPage() {
  const user = await requireUser()

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">Good to see you, {user.name.split(' ')[0]}</h2>
        <p className="text-sm text-ink-muted">Your priorities for today, with a reason for each one.</p>
      </div>

      <PriorityListOrEmpty userId={user.id} />
    </div>
  )
}

async function PriorityListOrEmpty({ userId }: { userId: string }) {
  const list = await PriorityList({ userId })

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center rounded border border-dashed border-border py-16 text-center">
        <Sparkles className="mb-3 h-6 w-6 text-ink-muted" />
        <p className="text-sm font-medium text-ink">Nothing needs your attention right now</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Priorities are generated every morning — hot leads, deals going cold, outstanding NDAs, and
          commissions due will show up here with a short reason for each one.
        </p>
      </div>
    )
  }

  return list
}
