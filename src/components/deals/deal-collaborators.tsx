'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, UserPlus } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { addDealCollaborator, removeDealCollaborator } from '@/lib/actions/deal-collaborators'
import type { User } from '@/lib/db/schema'

interface DealCollaboratorsProps {
  dealId: number
  collaborators: User[]
  addableUsers: User[]
  canManage: boolean
}

export function DealCollaborators({ dealId, collaborators, addableUsers, canManage }: DealCollaboratorsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleAdd(userId: string) {
    if (!userId) return
    startTransition(async () => {
      await addDealCollaborator(dealId, userId)
      router.refresh()
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeDealCollaborator(dealId, userId)
      router.refresh()
    })
  }

  if (!canManage && collaborators.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-ink">Helping agents</h3>
      {collaborators.length === 0 ? (
        <p className="mb-2 text-sm text-ink-muted">No one else has access to this deal yet.</p>
      ) : (
        <ul className="mb-2 flex flex-wrap gap-2">
          {collaborators.map((c) => (
            <li key={c.id} className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-sm text-ink">
              {c.name}
              {canManage && (
                <button
                  onClick={() => handleRemove(c.id)}
                  disabled={isPending}
                  aria-label={`Remove ${c.name}`}
                  className="text-ink-muted hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && addableUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-ink-muted" />
          <Select className="h-8 w-48 text-xs" disabled={isPending} defaultValue="" onChange={(e) => { handleAdd(e.target.value); e.target.value = '' }}>
            <option value="" disabled>
              Add a helping agent…
            </option>
            {addableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  )
}
