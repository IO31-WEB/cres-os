'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function RetryClassificationButton({ leadIntakeId }: { leadIntakeId: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function retry() {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/leads/${leadIntakeId}/qualify`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Retry failed.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="shrink-0 text-right">
      <Button size="sm" variant="outline" onClick={retry} disabled={isPending}>
        {isPending ? 'Retrying…' : 'Retry'}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
