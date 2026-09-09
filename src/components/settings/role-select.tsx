'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { updateUserRole } from '@/lib/actions/users'

export function RoleSelect({ userId, currentRole, disabled }: { userId: string; currentRole: string; disabled?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(role: string) {
    startTransition(async () => {
      await updateUserRole(userId, role as 'owner' | 'agent')
      router.refresh()
    })
  }

  return (
    <Select
      className="h-8 w-28 text-xs"
      defaultValue={currentRole}
      disabled={disabled || isPending}
      onChange={(e) => handleChange(e.target.value)}
    >
      <option value="owner">Owner</option>
      <option value="agent">Agent</option>
    </Select>
  )
}
