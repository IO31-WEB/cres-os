import { randomUUID } from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
] as const

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
}

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
    ResponseContentDisposition: `attachment; filename="${downloadFileName.replace(/"/g, '')}"`,
  })
  return getSignedUrl(client, command, { expiresIn: 600 }) // 10 minutes
}

/**
 * Post-upload verification: the presigned PUT URL can't itself enforce a
 * hard size cap (a client could lie about Content-Length), so this checks
 * the object that actually landed in R2 — real size, real content-type —
 * before the document record is allowed to be created. Anything that
 * fails is deleted immediately rather than left as an orphaned object.
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

  return { ok: true, sizeBytes }
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client()
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }))
}
