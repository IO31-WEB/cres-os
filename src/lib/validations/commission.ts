import { z } from 'zod'

export const COMMISSION_STATUSES = ['expected', 'invoiced', 'overdue', 'collected'] as const

export const commissionSchema = z.object({
  dealId: z.coerce.number().int().positive(),
  expectedAmount: z.coerce.number().positive('Enter an expected amount'),
  invoicedAmount: z.coerce.number().nonnegative().optional().or(z.literal('')),
  collectedAmount: z.coerce.number().nonnegative().optional().or(z.literal('')),
  status: z.enum(COMMISSION_STATUSES).default('expected'),
  dueDate: z.string().optional().or(z.literal('')),
})

export type CommissionInput = z.infer<typeof commissionSchema>
