import Anthropic from '@anthropic-ai/sdk'
import { CONTACT_TYPES } from '@/lib/validations/contact'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface LeadClassification {
  contactType: (typeof CONTACT_TYPES)[number]
  leadScore: 'hot' | 'warm' | 'nurture' | 'unqualified'
  leadScoreReason: string
  preferredLanguage: 'en' | 'es'
  ndaLikelyRequired: boolean
}

const SYSTEM_PROMPT = `You triage inbound leads for a commercial real estate and business brokerage firm in Tampa, FL.

Given the raw text of an inbound inquiry (a web form submission, email, or chat message), classify it. Respond with ONLY a JSON object, no markdown fences, no preamble:

{
  "contactType": one of ${JSON.stringify(CONTACT_TYPES)},
  "leadScore": one of ["hot", "warm", "nurture", "unqualified"],
  "leadScoreReason": a short (under 20 words) reason a broker would find useful at a glance,
  "preferredLanguage": "en" or "es" based on the language the message is written in,
  "ndaLikelyRequired": true if this looks like a business-buyer inquiry about a confidential business-for-sale listing, false otherwise
}

Scoring guide:
- hot: specific budget/timeline/property mentioned, ready to move now
- warm: genuine interest, some specifics, needs a call to qualify further
- nurture: early-stage browsing, no urgency signals yet
- unqualified: spam, wrong fit (e.g. residential-only, out of market), or no real intent`

export async function classifyLead(rawMessage: string): Promise<LeadClassification> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: rawMessage.slice(0, 4000) }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Classifier returned no text content')
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned) as LeadClassification

  if (!CONTACT_TYPES.includes(parsed.contactType)) parsed.contactType = 'other'
  if (!['hot', 'warm', 'nurture', 'unqualified'].includes(parsed.leadScore)) parsed.leadScore = 'nurture'
  if (!['en', 'es'].includes(parsed.preferredLanguage)) parsed.preferredLanguage = 'en'

  return parsed
}
