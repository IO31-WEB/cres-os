import { z } from 'zod'

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
  // The presign step (api/documents/upload-url) is the only place an
  // object key, content type, and size are ever decided — this form only
  // references that earlier step by id. See lib/actions/documents.ts for
  // why: it stops a client from ever submitting a bare/guessed/reused
  // object key directly into a document record.
  pendingUploadId: z.coerce.number().int().positive(),
  dealId: z.coerce.number().int().positive().optional().or(z.literal('')),
  contactId: z.coerce.number().int().positive().optional().or(z.literal('')),
  propertyId: z.coerce.number().int().positive().optional().or(z.literal('')),
})

export type DocumentRecordInput = z.infer<typeof documentRecordSchema>
