import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leadIntakes } from '@/lib/db/schema'
import { requireUser, isOwner } from '@/lib/auth'
import { leadIntakeSchema } from '@/lib/validations/lead-intake'
import { processLeadIntake } from '@/lib/ai/process-lead'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  // Unconverted lead intakes are unassigned by definition (same rule as
  // any other unassigned record) — only owners can see or retry them, so
  // the API enforces that too rather than relying on the UI hiding it.
  if (!isOwner(user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { id } = await params
  const leadIntakeId = Number(id)
  if (Number.isNaN(leadIntakeId)) {
    return NextResponse.json({ error: 'Invalid lead intake id' }, { status: 400 })
  }

  const [intake] = await db.select().from(leadIntakes).where(eq(leadIntakes.id, leadIntakeId)).limit(1)
  if (!intake) {
    return NextResponse.json({ error: 'Lead intake not found' }, { status: 404 })
  }

  const payload = leadIntakeSchema.safeParse(intake.rawPayload)
  if (!payload.success) {
    return NextResponse.json({ error: 'Stored payload is malformed and cannot be re-classified.' }, { status: 422 })
  }

  try {
    const contactId = await processLeadIntake(leadIntakeId, payload.data)
    return NextResponse.json({ contactId, status: 'converted' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Classification failed again.' },
      { status: 502 }
    )
  }
}
