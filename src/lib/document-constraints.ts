/**
 * Pure data, no server dependencies (no AWS SDK, no credentials) — safe to
 * import from client components for instant "is this file allowed"
 * feedback before ever hitting the network. lib/r2.ts (server-only, R2
 * credentials + AWS SDK) re-exports these for convenience on the server
 * side, but nothing server-only should ever be added to this file.
 */

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

export const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
}
