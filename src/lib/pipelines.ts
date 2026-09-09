export const PIPELINES = {
  business_brokerage: {
    label: 'Business Brokerage',
    stages: ['Inquiry', 'NDA', 'Financials Review', 'LOI', 'Due Diligence', 'Closing'],
  },
  tenant_rep: {
    label: 'Tenant Representation',
    stages: ['Needs Assessment', 'Site Tours', 'Proposal/LOI', 'Lease Negotiation', 'Executed'],
  },
  landlord_rep: {
    label: 'Landlord Representation',
    stages: ['New Listing', 'Marketing', 'Showings', 'Proposal/LOI', 'Lease Negotiation', 'Executed'],
  },
  seller_rep: {
    label: 'Commercial Sales — Seller Rep',
    stages: ['New Listing', 'Marketing', 'Offers', 'Under Contract', 'Due Diligence', 'Closed'],
  },
  buyer_rep: {
    label: 'Commercial Acquisitions — Buyer Rep',
    stages: ['Criteria Defined', 'Property Search', 'Offer', 'Under Contract', 'Due Diligence', 'Closed'],
  },
} as const

export type PipelineId = keyof typeof PIPELINES

export const PIPELINE_IDS = Object.keys(PIPELINES) as PipelineId[]

export function stagesFor(pipeline: string): readonly string[] {
  return PIPELINES[pipeline as PipelineId]?.stages ?? []
}

export function isValidStage(pipeline: string, stage: string): boolean {
  return stagesFor(pipeline).includes(stage)
}

export function defaultStage(pipeline: string): string {
  return stagesFor(pipeline)[0] ?? ''
}
