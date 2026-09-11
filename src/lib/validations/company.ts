import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  industry: z.string().max(100).optional().or(z.literal('')),
  assignedToUserId: z.string().optional().or(z.literal('')),
  website: z
    .string()
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform((val) => {
      if (!val) return val
      return /^https?:\/\//i.test(val) ? val : `https://${val}`
    })
    .pipe(z.string().url('Enter a valid website address').max(255).optional().or(z.literal(''))),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type CompanyInput = z.infer<typeof companySchema>
