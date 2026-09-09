import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leadIntakes } from '@/lib/db/schema'
import { leadIntakeSchema } from '@/lib/validations/lead-intake'
import { processLeadIntake } from '@/lib/ai/process-lead'

/**
 * Single entry point for every inbound channel (website form, email
 * forwarding rule, Facebook/Messenger, WhatsApp, BizBuySell, or a manual
 * paste from the owner). Each integration is configured to POST here with
 * its own `source` value — see docs/MODULE_8_SETUP.md for per-channel
 * setup notes.
 *
 * Auth is a shared secret rather than Clerk, since these are server-to-
 * server calls with no user session.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.LEAD_INTAKE_SECRET
  const provided = req.headers.get('x-lead-intake-secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload
  try {
    payload = leadIntakeSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid lead payload — name and message are required.' }, { status: 400 })
  }

  const [intake] = await db
    .insert(leadIntakes)
    .values({
      source: payload.source,
      rawPayload: payload,
      status: 'new',
    })
    .returning({ id: leadIntakes.id })

  try {
    const contactId = await processLeadIntake(intake.id, payload)
    return NextResponse.json({ leadIntakeId: intake.id, contactId, status: 'converted' })
  } catch {
    // The intake row is preserved as 'new' with the error recorded in
    // aiClassification (see processLeadIntake) so it can be retried via
    // the manual qualify endpoint instead of being silently lost.
    return NextResponse.json(
      { leadIntakeId: intake.id, status: 'received_pending_classification' },
      { status: 202 }
    )
  }
}
