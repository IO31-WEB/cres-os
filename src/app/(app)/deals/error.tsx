'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border py-16 text-center">
      <AlertTriangle className="mb-3 h-6 w-6 text-red-500" />
      <p className="text-sm font-medium text-ink">Something went wrong loading this page</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button size="sm" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
