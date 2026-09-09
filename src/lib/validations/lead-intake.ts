import { z } from 'zod'
import { CONTACT_SOURCES } from '@/lib/validations/contact'

export const leadIntakeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  message: z.string().min(1).max(4000),
  source: z.enum(CONTACT_SOURCES).default('manual'),
})

export type LeadIntakePayload = z.infer<typeof leadIntakeSchema>
