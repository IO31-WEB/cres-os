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
  fileUrl: z.string().url(),
  dealId: z.coerce.number().int().positive().optional().or(z.literal('')),
  contactId: z.coerce.number().int().positive().optional().or(z.literal('')),
  propertyId: z.coerce.number().int().positive().optional().or(z.literal('')),
})

export type DocumentRecordInput = z.infer<typeof documentRecordSchema>
