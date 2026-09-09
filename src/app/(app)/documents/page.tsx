import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents, deals } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DOCUMENT_TYPE_LABELS } from '@/lib/validations/document'
import type { DOCUMENT_TYPES } from '@/lib/validations/document'
import { setDocumentStatus, deleteDocument } from '@/lib/actions/documents'

const NEXT_STATUS: Record<string, 'sent' | 'viewed' | 'signed' | null> = {
  draft: 'sent',
  sent: 'viewed',
  viewed: 'signed',
  signed: null,
  expired: null,
}

export default async function DocumentsPage() {
  const rows = await db
    .select({ document: documents, dealName: deals.name })
    .from(documents)
    .leftJoin(deals, eq(documents.dealId, deals.id))
    .orderBy(desc(documents.createdAt))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Documents</h2>
          <p className="text-sm text-ink-muted">{rows.length} total</p>
        </div>
        <Button asChild size="sm">
          <Link href="/documents/new">
            <Plus className="h-4 w-4" /> New document
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="NDAs, LOIs, PSAs, leases, and financials all live here, linked to their deal."
          actionHref="/documents/new"
          actionLabel="New document"
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ document, dealName }) => {
            const next = NEXT_STATUS[document.status]
            const boundAdvance = next ? setDocumentStatus.bind(null, document.id, next) : null
            const boundDelete = deleteDocument.bind(null, document.id)

            return (
              <div key={document.id} className="flex items-center justify-between rounded border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{document.fileName}</p>
                  <p className="text-xs text-ink-muted">
                    {DOCUMENT_TYPE_LABELS[document.type as (typeof DOCUMENT_TYPES)[number]] ?? document.type}
                    {dealName && ` · ${dealName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={document.status === 'signed' ? 'green' : document.status === 'expired' ? 'red' : 'neutral'}>
                    {document.status}
                  </Badge>
                  {boundAdvance && (
                    <form action={boundAdvance}>
                      <Button type="submit" size="sm" variant="outline">
                        Mark {next}
                      </Button>
                    </form>
                  )}
                  <form action={boundDelete}>
                    <Button type="submit" size="sm" variant="ghost">
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
