'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DraftMessageBox({ message }: { message: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-2 rounded border border-border bg-canvas p-3">
      <p className="text-sm italic text-ink-muted">&ldquo;{message}&rdquo;</p>
      <Button size="sm" variant="outline" className="mt-2" onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy draft'}
      </Button>
    </div>
  )
}
