'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <AlertTriangle className="mb-3 h-6 w-6 text-red-500" />
      <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{error.message || 'An unexpected error occurred.'}</p>
      <button onClick={reset} className="mt-4 rounded bg-navy px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  )
}
