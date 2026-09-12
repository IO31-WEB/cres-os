import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { canViewDocument } from '@/lib/visibility'
import { createDownloadUrl } from '@/lib/r2'
import { logAuditBestEffort } from '@/lib/audit'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()

  const { id } = await params
  const documentId = Number(id)
  if (Number.isNaN(documentId)) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 })
  }

  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1)
  if (!doc) {
    // Same response whether it doesn't exist or the person can't see it —
    // a 403 vs 404 split would tell an attacker which document ids exist.
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!(await canViewDocument(user, doc))) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const signedUrl = await createDownloadUrl(doc.objectKey, doc.fileName)
    // Note: this logs that a download link was issued, not the signed URL
    // itself — never write a signed URL (a bearer credential) into the
    // audit trail.
    await logAuditBestEffort({
      user,
      action: 'document.download',
      entityType: 'document',
      entityId: documentId,
      metadata: { fileName: doc.fileName },
    })
    return NextResponse.redirect(signedUrl)
  } catch (err) {
    console.error('R2 download URL error', err)
    return NextResponse.json({ error: 'Could not generate download link. Try again in a moment.' }, { status: 500 })
  }
}
