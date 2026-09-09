import { z } from 'zod'

export const CONTACT_TYPES = [
  'business_buyer',
  'business_seller',
  'tenant',
  'landlord',
  'property_buyer',
  'property_seller',
  'past_client',
  'other',
] as const

export const LEAD_SCORES = ['hot', 'warm', 'nurture', 'unqualified'] as const

export const CONTACT_SOURCES = [
  'website',
  'email',
  'facebook',
  'whatsapp',
  'bizbuysell',
  'manual',
  'referral',
] as const

export const CONTACT_TYPE_LABELS: Record<(typeof CONTACT_TYPES)[number], string> = {
  business_buyer: 'Business buyer',
  business_seller: 'Business seller',
  tenant: 'Tenant',
  landlord: 'Landlord',
  property_buyer: 'Property buyer',
  property_seller: 'Property seller',
  past_client: 'Past client',
  other: 'Other',
}

export const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').max(255).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  whatsapp: z.string().max(30).optional().or(z.literal('')),
  preferredLanguage: z.enum(['en', 'es']).default('en'),
  companyId: z.coerce.number().int().positive().optional().or(z.literal('')),
  contactType: z.enum(CONTACT_TYPES).default('other'),
  leadScore: z.enum(LEAD_SCORES).default('nurture'),
  source: z.enum(CONTACT_SOURCES).default('manual'),
  assignedToUserId: z.string().optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type ContactInput = z.infer<typeof contactSchema>
