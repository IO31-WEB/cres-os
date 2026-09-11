import { z } from 'zod'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '@/lib/r2'

export const DOCUMENT_TYPES = ['nda', 'loi', 'psa', 'lease', 'financials', 'other'] as const
export const DOCUMENT_STATUSES = ['draft', 'sent', 'viewed', 'signed', 'expired'] as const

export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  nda: 'NDA',
  loi: 'Letter of Intent',
  psa: 'Purchase & Sale Agreement',
  lease: 'Lease',
  financials: 'Financials',
  other: 'Other',
}

export const documentRecordSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  fileName: z.string().min(1).max(255),
  objectKey: z.string().min(1).max(500),
  contentType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  fileSize: z.coerce.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
  dealId: z.coerce.number().int().positive().optional().or(z.literal('')),
  contactId: z.coerce.number().int().positive().optional().or(z.literal('')),
  propertyId: z.coerce.number().int().positive().optional().or(z.literal('')),
})

export type DocumentRecordInput = z.infer<typeof documentRecordSchema>
