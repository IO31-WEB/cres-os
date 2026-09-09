import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  industry: z.string().max(100).optional().or(z.literal('')),
  website: z.string().url('Enter a full URL, e.g. https://example.com').max(255).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type CompanyInput = z.infer<typeof companySchema>
