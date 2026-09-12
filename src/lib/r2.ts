import { randomUUID } from 'crypto'
import 'server-only'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES, EXTENSION_BY_MIME } from '@/lib/document-constraints'

// Re-exported for existing server-side call sites — new code that only
// needs the constants (no R2 client) should import lib/document-constraints
// directly instead, so it stays out of any client bundle that touches it.
export { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES }

/**
 * R2 is S3-compatible, so the standard AWS SDK works against it — just
 * point the endpoint at the account's R2 URL. Same pattern used for the
 * brand-kit uploads on ListOps.
 *
 * The bucket itself must be PRIVATE (no public access, no r2.dev URL
 * enabled) — every read goes through createDownloadUrl() below, which is
 * permission-checked server-side before a short-lived signed URL is ever
 * handed out. See docs/MODULE_SECURITY_SETUP.md.
 */
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getBucket(): string {
  const bucket = process.env.R2_DOCUMENTS_BUCKET
  if (!bucket) throw new Error('R2_DOCUMENTS_BUCKET is not configured.')
  return bucket
}

// Whitelist only — anything else is rejected both client- and server-side.
// (Defined in lib/document-constraints.ts, re-exported above.)

/**
 * Strips the original filename down to something safe to display and to
 * put in a Content-Disposition header — no path separators, no control
 * characters, capped length. This is the *display* name; it is never used
 * to build the storage path (see documentKey below), so a malicious
 * filename can't influence where the object is actually stored.
 */
export function sanitizeFileName(rawName: string): string {
  const base = rawName
    .replace(/[\\/]/g, '_') // no path separators
    .replace(/[\x00-\x1f\x7f]/g, '') // no control characters
    .trim()
    .slice(0, 200)
  return base.length > 0 ? base : 'document'
}

/**
 * Builds an RFC 6266 / RFC 5987-compliant Content-Disposition value.
 *
 * The old version did `filename="${name.replace(/"/g, '')}"` — stripping
 * quotes is not the same as encoding the value. Unicode, backslashes,
 * semicolons, and control characters all pass straight into a raw HTTP
 * header, which (depending on the HTTP stack) can distort how the browser
 * parses the field, produce mojibake for non-ASCII names, or in the worst
 * case be used to inject additional header-like content. This version:
 *   - Always emits an ASCII-safe `filename="..."` fallback for clients
 *     that don't support the extended form (non-ASCII chars replaced with
 *     `_`, quotes/backslashes/control chars stripped or escaped).
 *   - Always also emits `filename*=UTF-8''<percent-encoded>` (RFC 5987),
 *     which every modern browser prefers and which correctly round-trips
 *     any Unicode filename.
 */
export function contentDisposition(rawName: string): string {
  const name = sanitizeFileName(rawName)

  const asciiFallback = name
    .replace(/[^\x20-\x7e]/g, '_') // strip anything outside printable ASCII
    .replace(/["\\]/g, '_') // quotes/backslashes would break the quoted-string
    .replace(/[\r\n]/g, '') // defense in depth against header injection

  const encoded = encodeURIComponent(name)
    // encodeURIComponent leaves a few chars valid in a URI but not in the
    // RFC 5987 `attr-char` grammar — escape those too.
    .replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}

/**
 * Unpredictable, non-enumerable storage key — knowing one document's key
 * (or guessing a timestamp-based one) gives no way to find another. The
 * mime-derived extension is cosmetic only; access is never granted by key
 * guessing since every read goes through the permission-checked download
 * route, not a direct/public URL.
 */
export function documentKey(contentType: string): string {
  const ext = EXTENSION_BY_MIME[contentType] ?? ''
  return `documents/${randomUUID()}${ext}`
}

export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const client = getR2Client()
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType })
  // Upload URLs expire quickly — a leaked/logged presigned PUT URL is only
  // a usable write credential for 5 minutes.
  return getSignedUrl(client, command, { expiresIn: 300 })
}

/**
 * Short-lived signed GET — the only way a document's bytes are ever
 * reachable. Callers MUST run a permission check (see canViewDocument in
 * lib/visibility.ts) before calling this; this function itself has no
 * concept of who's asking.
 */
export async function createDownloadUrl(key: string, downloadFileName: string): Promise<string> {
  const client = getR2Client()
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ResponseContentDisposition: contentDisposition(downloadFileName),
  })
  return getSignedUrl(client, command, { expiresIn: 600 }) // 10 minutes
}

/**
 * First few bytes ("magic numbers") that identify each allowed file type,
 * independent of whatever Content-Type header the browser sent at upload
 * time (never trusted — browsers/clients can claim anything). `.doc`/
 * `.xls` (legacy OLE2 container) share one signature; `.docx`/`.xlsx`
 * (zip-based OOXML) share another, so those pairs can't be distinguished
 * from bytes alone — that's fine, we only need to confirm the upload is
 * *a* well-formed file of the broad family it claims to be, not pin down
 * the exact extension.
 */
const SIGNATURES: { contentTypes: readonly string[]; check: (bytes: Buffer) => boolean }[] = [
  { contentTypes: ['application/pdf'], check: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { contentTypes: ['image/png'], check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { contentTypes: ['image/jpeg'], check: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  {
    contentTypes: ['image/webp'],
    check: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    contentTypes: ['application/msword', 'application/vnd.ms-excel'],
    check: (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
  {
    contentTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    check: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), // ZIP local file header
  },
]

/**
 * Reads just the first 16 bytes of the uploaded object back from R2 and
 * checks them against the expected file signature for the declared
 * content type. This is what actually stops someone from renaming an
 * executable/script to `.pdf` and uploading it — the MIME type and
 * extension are both just labels the client chose; the magic bytes are
 * closer to ground truth about what the file actually is (though still
 * not a substitute for real malware scanning — see the note in
 * verifyUploadedObject below).
 */
async function verifyFileSignature(key: string, expectedContentType: string): Promise<boolean> {
  const signature = SIGNATURES.find((s) => s.contentTypes.includes(expectedContentType))
  if (!signature) return true // no known signature to check for this type — don't false-reject

  const client = getR2Client()
  try {
    const object = await client.send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key, Range: 'bytes=0-15' })
    )
    const chunks: Uint8Array[] = []
    // @ts-expect-error - Body is a web/node stream depending on runtime; both are async-iterable.
    for await (const chunk of object.Body) chunks.push(chunk)
    const bytes = Buffer.concat(chunks)
    return signature.check(bytes)
  } catch {
    return false
  }
}

/**
 * Post-upload verification: the presigned PUT URL can't itself enforce a
 * hard size cap (a client could lie about Content-Length), so this checks
 * the object that actually landed in R2 — real size, real content-type —
 * before the document record is allowed to be created. Anything that
 * fails is deleted immediately rather than left as an orphaned object.
 *
 * LIMITATION (documented, not fixed here): this checks structure (size,
 * declared vs actual MIME, magic bytes) but does not scan file *contents*
 * for malware — e.g. a PDF with an embedded malicious script, or a Word
 * doc with a malicious macro, would pass these checks. No antivirus/
 * malware-scanning step exists in this V1. If that's needed, the natural
 * integration point is here: call a scanning service (e.g. ClamAV via a
 * sidecar, or a cloud DLP/AV API) on the object before returning `ok`,
 * and reject (deleting the object) on a positive match. Documents are
 * also never executed by the application server (they're opaque blobs
 * served via signed URL, never `eval`'d, `require`'d, or executed).
 */
export async function verifyUploadedObject(
  key: string,
  expectedContentType: string
): Promise<{ ok: true; sizeBytes: number } | { ok: false; error: string }> {
  const client = getR2Client()

  let head
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }))
  } catch {
    return { ok: false, error: 'Upload could not be found — please try again.' }
  }

  const sizeBytes = head.ContentLength ?? 0
  const actualContentType = head.ContentType ?? ''

  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    await deleteObject(key).catch(() => {})
    return { ok: false, error: `File is too large (max ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024}MB).` }
  }

  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(expectedContentType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    await deleteObject(key).catch(() => {})
    return { ok: false, error: 'File type is not allowed.' }
  }

  // The type actually stored in R2 should match what was declared at
  // presign time — if it doesn't, something intercepted or altered the
  // upload between presigning and PUT.
  if (actualContentType && actualContentType !== expectedContentType) {
    await deleteObject(key).catch(() => {})
    return { ok: false, error: 'Uploaded file type did not match what was declared.' }
  }

  // Never trust the client/browser's Content-Type claim alone — confirm
  // the bytes actually look like the file type being claimed.
  const signatureOk = await verifyFileSignature(key, expectedContentType)
  if (!signatureOk) {
    await deleteObject(key).catch(() => {})
    return { ok: false, error: 'File contents did not match the declared file type.' }
  }

  return { ok: true, sizeBytes }
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client()
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }))
}
