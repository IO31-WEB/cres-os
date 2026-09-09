import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { PIPELINES, type PipelineId } from '@/lib/pipelines'
import type { Deal } from '@/lib/db/schema'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/**
 * Drafts a short, low-pressure re-engagement message for a deal that's
 * gone quiet. Always returned for the owner to review and edit before
 * sending — never sent automatically.
 */
export async function draftReengagement(deal: Deal): Promise<string> {
  const contact = deal.contactId
    ? (await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1))[0]
    : undefined

  const pipelineLabel = PIPELINES[deal.pipeline as PipelineId]?.label ?? deal.pipeline

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 200,
    system:
      'You write brief, warm, low-pressure follow-up messages for a commercial real estate and business brokerage firm. Two to four sentences. No pressure tactics, no fake urgency. Sign off as "Mari" unless told otherwise. Respond with ONLY the message text, no preamble.',
    messages: [
      {
        role: 'user',
        content: `Draft a re-engagement message for this contact, whose deal has gone quiet.

Contact: ${contact ? `${contact.firstName} ${contact.lastName ?? ''}`.trim() : 'Unknown'}
Deal: ${deal.name}
Pipeline: ${pipelineLabel}
Current stage: ${deal.stage}
Preferred language: ${contact?.preferredLanguage === 'es' ? 'Spanish' : 'English'}`,
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Re-engagement draft returned no text content')
  }

  return textBlock.text.trim()
}
