import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <Compass className="mb-3 h-6 w-6 text-ink-muted" />
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        This page doesn&rsquo;t exist, or the record may have been deleted.
      </p>
      <Link href="/dashboard" className="mt-4 text-sm text-navy hover:underline dark:text-white">
        Back to Priorities
      </Link>
    </div>
  )
}
