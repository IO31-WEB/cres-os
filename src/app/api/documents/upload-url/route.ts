import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createUploadUrl, documentKey, ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '@/lib/r2'
import { db } from '@/lib/db'
import { pendingUploads } from '@/lib/db/schema'
import { checkAndIncrementDailyLimit } from '@/lib/rate-limit'
import { assertDealLinkable, assertContactLinkable, assertPropertyLinkable } from '@/lib/actions/link-guard'

const UPLOAD_URL_EXPIRY_SECONDS = 300

const requestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES, {
    errorMap: () => ({ message: 'That file type is not allowed.' }),
  }),
  fileSize: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES, 'File is too large.'),
  dealId: z.number().int().positive().optional(),
  contactId: z.number().int().positive().optional(),
  propertyId: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null)
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  // Presign requests are cheap but not free (they touch R2 and create a
  // DB row) — cap volume per user so a scripted loop can't spam pending
  // uploads. This is a generous ceiling for legitimate use, not a precise
  // per-user quota.
  const limit = await checkAndIncrementDailyLimit(`upload-url:${user.id}`, 200)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many upload requests today. Try again tomorrow.' }, { status: 429 })
  }

  let parsed: z.infer<typeof requestSchema>
  try {
    parsed = requestSchema.parse(await req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid upload request.'
    return NextResponse.json({ error: message ?? 'Invalid upload request.' }, { status: 400 })
  }

  // Never presign an upload destined for a record the user can't see —
  // checked again at finalize time too, in case access changes in between.
  const dealId = parsed.dealId ?? null
  const contactId = parsed.contactId ?? null
  const propertyId = parsed.propertyId ?? null
  const linkError =
    (await assertDealLinkable(user, dealId)) ??
    (await assertContactLinkable(user, contactId)) ??
    (await assertPropertyLinkable(user, propertyId))
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 403 })
  }

  // Key is derived only from the content type (for a cosmetic extension)
  // and a random UUID — the client-supplied fileName never influences
  // where the object is stored, only the display name saved alongside it.
  const key = documentKey(parsed.contentType)
  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000)

  try {
    const uploadUrl = await createUploadUrl(key, parsed.contentType)

    // The pending-upload row is what lets createDocumentRecord() trust the
    // object key/content-type/size instead of a bare client-supplied
    // value — it records what THIS user was actually issued a presigned
    // URL for, and expires alongside the URL itself.
    const [pending] = await db
      .insert(pendingUploads)
      .values({
        userId: user.id,
        objectKey: key,
        declaredFileName: parsed.fileName,
        declaredContentType: parsed.contentType,
        declaredSizeBytes: parsed.fileSize,
        dealId,
        contactId,
        propertyId,
        status: 'pending',
        expiresAt,
      })
      .returning({ id: pendingUploads.id })

    return NextResponse.json({ uploadUrl, pendingUploadId: pending.id, expiresAt: expiresAt.toISOString() })
  } catch (err) {
    // Don't leak internals (bucket name, credential errors) to the client.
    console.error('R2 presign error', err)
    return NextResponse.json({ error: 'Could not prepare upload. Try again in a moment.' }, { status: 500 })
  }
}
