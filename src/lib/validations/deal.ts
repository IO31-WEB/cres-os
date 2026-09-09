import { z } from 'zod'
import { PIPELINE_IDS, isValidStage } from '@/lib/pipelines'

export const NDA_STATUSES = ['not_applicable', 'nda_required', 'nda_sent', 'nda_signed'] as const

export const dealSchema = z
  .object({
    name: z.string().min(1, 'Deal name is required').max(255),
    pipeline: z.enum(PIPELINE_IDS as [string, ...string[]]),
    stage: z.string().min(1),
    contactId: z.coerce.number().int().positive().optional().or(z.literal('')),
    companyId: z.coerce.number().int().positive().optional().or(z.literal('')),
    propertyId: z.coerce.number().int().positive().optional().or(z.literal('')),
    value: z.coerce.number().nonnegative().optional().or(z.literal('')),
    probability: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
    ndaStatus: z.enum(NDA_STATUSES).default('not_applicable'),
    expectedCloseDate: z.string().optional().or(z.literal('')),
    assignedToUserId: z.string().optional().or(z.literal('')),
  })
  .refine((d) => isValidStage(d.pipeline, d.stage), {
    message: 'Stage does not belong to the selected pipeline',
    path: ['stage'],
  })

export type DealInput = z.infer<typeof dealSchema>
