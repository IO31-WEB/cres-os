import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { contacts, leadIntakes } from '@/lib/db/schema'
import { classifyLead } from '@/lib/ai/lead-classifier'
import { findExistingContact } from '@/lib/ai/dedupe'
import type { LeadIntakePayload } from '@/lib/validations/lead-intake'

/**
 * Runs AI classification on a raw inbound message, then either updates the
 * matching existing contact (dedup by email/phone) or creates a new one.
 * Used by both the inbound webhook (automatic, on arrival) and the manual
 * qualify endpoint (re-run, e.g. after the AI call failed the first time).
 */
export async function processLeadIntake(leadIntakeId: number, payload: LeadIntakePayload): Promise<number> {
  await db.update(leadIntakes).set({ status: 'processing' }).where(eq(leadIntakes.id, leadIntakeId))

  let classification
  try {
    classification = await classifyLead(payload.message)
  } catch (err) {
    await db
      .update(leadIntakes)
      .set({
        status: 'new',
        aiClassification: { error: err instanceof Error ? err.message : 'Classification failed' },
      })
      .where(eq(leadIntakes.id, leadIntakeId))
    throw err
  }

  const existing = await findExistingContact(payload.email, payload.phone)
  const [firstName, ...rest] = payload.name.trim().split(/\s+/)
  const lastName = rest.join(' ') || null

  let contactId: number

  if (existing) {
    await db
      .update(contacts)
      .set({
        // A returning lead is worth a fresh look — bump score/reason, but
        // don't clobber a human-assigned contactType with the AI's guess
        // unless the record was still 'other' (i.e. never manually set).
        contactType: existing.contactType === 'other' ? classification.contactType : existing.contactType,
        leadScore: classification.leadScore,
        leadScoreReason: classification.leadScoreReason,
        preferredLanguage: classification.preferredLanguage,
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, existing.id))
    contactId = existing.id
  } else {
    const [created] = await db
      .insert(contacts)
      .values({
        firstName,
        lastName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        whatsapp: payload.whatsapp ?? null,
        contactType: classification.contactType,
        leadScore: classification.leadScore,
        leadScoreReason: classification.leadScoreReason,
        preferredLanguage: classification.preferredLanguage,
        source: payload.source,
        lastContactedAt: new Date(),
      })
      .returning({ id: contacts.id })
    contactId = created.id
  }

  await db
    .update(leadIntakes)
    .set({
      status: 'converted',
      dedupedContactId: contactId,
      aiClassification: classification,
    })
    .where(eq(leadIntakes.id, leadIntakeId))

  return contactId
}
