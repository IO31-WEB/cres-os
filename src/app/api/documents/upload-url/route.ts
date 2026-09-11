import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createUploadUrl, documentKey, ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '@/lib/r2'

const requestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES, {
    errorMap: () => ({ message: 'That file type is not allowed.' }),
  }),
  fileSize: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES, 'File is too large.'),
})

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null)
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  let parsed: z.infer<typeof requestSchema>
  try {
    parsed = requestSchema.parse(await req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid upload request.'
    return NextResponse.json({ error: message ?? 'Invalid upload request.' }, { status: 400 })
  }

  // Key is derived only from the content type (for a cosmetic extension)
  // and a random UUID — the client-supplied fileName never influences
  // where the object is stored, only the display name saved alongside it.
  const key = documentKey(parsed.contentType)

  try {
    const uploadUrl = await createUploadUrl(key, parsed.contentType)
    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    // Don't leak internals (bucket name, credential errors) to the client.
    console.error('R2 presign error', err)
    return NextResponse.json({ error: 'Could not prepare upload. Try again in a moment.' }, { status: 500 })
  }
}
