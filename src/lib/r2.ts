import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * R2 is S3-compatible, so the standard AWS SDK works against it — just
 * point the endpoint at the account's R2 URL. Same pattern used for the
 * brand-kit uploads on ListOps.
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

export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const client = getR2Client()
  const bucket = process.env.R2_DOCUMENTS_BUCKET
  if (!bucket) throw new Error('R2_DOCUMENTS_BUCKET is not configured.')

  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })
  return getSignedUrl(client, command, { expiresIn: 300 })
}

export function publicUrlFor(key: string): string {
  const publicBase = process.env.R2_DOCUMENTS_PUBLIC_URL
  if (!publicBase) throw new Error('R2_DOCUMENTS_PUBLIC_URL is not configured.')
  return `${publicBase.replace(/\/$/, '')}/${key}`
}

export function documentKey(fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  return `documents/${Date.now()}-${safeName}`
}
