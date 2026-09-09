import { z } from 'zod'

export const PROPERTY_TYPES = ['retail', 'office', 'industrial', 'land', 'multifamily', 'business', 'mixed_use'] as const

export const LISTING_STATUSES = ['off_market', 'active', 'under_contract', 'sold', 'leased', 'withdrawn'] as const

export const PROPERTY_TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], string> = {
  retail: 'Retail',
  office: 'Office',
  industrial: 'Industrial',
  land: 'Land',
  multifamily: 'Multifamily',
  business: 'Business',
  mixed_use: 'Mixed use',
}

export const LISTING_STATUS_LABELS: Record<(typeof LISTING_STATUSES)[number], string> = {
  off_market: 'Off market',
  active: 'Active',
  under_contract: 'Under contract',
  sold: 'Sold',
  leased: 'Leased',
  withdrawn: 'Withdrawn',
}

export const propertySchema = z.object({
  address: z.string().min(5, 'Enter a street address').max(300),
  propertyType: z.enum(PROPERTY_TYPES).default('retail'),
  defaultBusinessProfile: z.string().max(50).default('general'),
  listingStatus: z.enum(LISTING_STATUSES).default('off_market'),
  ownerContactId: z.coerce.number().int().positive().optional().or(z.literal('')),
  sqft: z.coerce.number().int().positive().optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type PropertyInput = z.infer<typeof propertySchema>
