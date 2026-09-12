'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { dealSchema } from '@/lib/validations/deal'
import { parseForm, fieldError, type ActionState } from '@/lib/actions/form-state'
import { isValidStage, defaultStage } from '@/lib/pipelines'
import { canViewDeal, resolveAssignment } from '@/lib/visibility'
import { assertContactLinkable, assertCompanyLinkable, assertPropertyLinkable, assertUserExists } from '@/lib/actions/link-guard'
import { logAuditBestEffort } from '@/lib/audit'
import { runDeleteOrFriendlyError } from '@/lib/db/errors'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

async function assertCanEditDeal(user: Awaited<ReturnType<typeof requireUser>>, dealId: number) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!deal || !(await canViewDeal(user, deal))) notFound()
  return deal
}

export async function createDeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(dealSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const contactId = d.contactId ? Number(d.contactId) : null
  const companyId = d.companyId ? Number(d.companyId) : null
  const propertyId = d.propertyId ? Number(d.propertyId) : null

  // Never trust a client-supplied contactId/companyId/propertyId — verify
  // the requesting user can actually see each linked record first (this is
  // the IDOR fix: previously any agent could create a deal pointing at any
  // contact/company/property id, including ones assigned to someone else).
  const contactError = await assertContactLinkable(user, contactId)
  if (contactError) return fieldError('contactId', contactError)
  const companyError = await assertCompanyLinkable(user, companyId)
  if (companyError) return fieldError('companyId', companyError)
  const propertyError = await assertPropertyLinkable(user, propertyId)
  if (propertyError) return fieldError('propertyId', propertyError)

  const assignment = resolveAssignment(user, orNull(d.assignedToUserId))
  if (!assignment.ok) return fieldError('assignedToUserId', assignment.error)
  const userError = await assertUserExists(assignment.value)
  if (userError) return fieldError('assignedToUserId', userError)

  const [created] = await db
    .insert(deals)
    .values({
      name: d.name,
      pipeline: d.pipeline,
      stage: d.stage || defaultStage(d.pipeline),
      contactId,
      companyId,
      propertyId,
      value: d.value ? Number(d.value) : null,
      probability: d.probability !== '' && d.probability !== undefined ? Number(d.probability) : null,
      ndaStatus: d.ndaStatus,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
      assignedToUserId: assignment.value,
    })
    .returning({ id: deals.id })

  await logAuditBestEffort({ user, action: 'deal.create', entityType: 'deal', entityId: created.id })

  revalidatePath('/deals')
  redirect(`/deals/${created.id}`)
}

export async function updateDeal(dealId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const existing = await assertCanEditDeal(user, dealId)

  const parsed = parseForm(dealSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const contactId = d.contactId ? Number(d.contactId) : null
  const companyId = d.companyId ? Number(d.companyId) : null
  const propertyId = d.propertyId ? Number(d.propertyId) : null

  const contactError = await assertContactLinkable(user, contactId)
  if (contactError) return fieldError('contactId', contactError)
  const companyError = await assertCompanyLinkable(user, companyId)
  if (companyError) return fieldError('companyId', companyError)
  const propertyError = await assertPropertyLinkable(user, propertyId)
  if (propertyError) return fieldError('propertyId', propertyError)

  const assignment = resolveAssignment(user, orNull(d.assignedToUserId), existing.assignedToUserId)
  if (!assignment.ok) return fieldError('assignedToUserId', assignment.error)
  const userError = await assertUserExists(assignment.value)
  if (userError) return fieldError('assignedToUserId', userError)

  await db
    .update(deals)
    .set({
      name: d.name,
      pipeline: d.pipeline,
      stage: d.stage,
      contactId,
      companyId,
      propertyId,
      value: d.value ? Number(d.value) : null,
      probability: d.probability !== '' && d.probability !== undefined ? Number(d.probability) : null,
      ndaStatus: d.ndaStatus,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
      assignedToUserId: assignment.value,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    })
    .where(eq(deals.id, dealId))

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  redirect(`/deals/${dealId}`)
}

export async function updateDealStage(dealId: number, pipeline: string, newStage: string): Promise<void> {
  const user = await requireUser()
  await assertCanEditDeal(user, dealId)

  if (!isValidStage(pipeline, newStage)) {
    throw new Error('Invalid stage for this pipeline')
  }

  await db
    .update(deals)
    .set({ stage: newStage, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(deals.id, dealId))

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
}

export async function setDealStatus(dealId: number, status: 'open' | 'won' | 'lost', lostReason?: string): Promise<void> {
  const user = await requireUser()
  await assertCanEditDeal(user, dealId)

  await db
    .update(deals)
    .set({ status, lostReason: status === 'lost' ? (lostReason ?? null) : null, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(deals.id, dealId))

  await logAuditBestEffort({ user, action: 'deal.status_change', entityType: 'deal', entityId: dealId, metadata: { status } })

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
}

export async function deleteDeal(dealId: number): Promise<void> {
  const user = await requireUser()
  await assertCanEditDeal(user, dealId)

  // commissions.deal_id is ON DELETE RESTRICT on purpose (financial
  // records shouldn't silently vanish) — turn that into a clear message
  // instead of a raw FK-violation error.
  await runDeleteOrFriendlyError(
    () => db.delete(deals).where(eq(deals.id, dealId)),
    'This deal has commission records attached. Delete those first, then delete the deal.'
  )
  await logAuditBestEffort({ user, action: 'deal.delete', entityType: 'deal', entityId: dealId })
  revalidatePath('/deals')
  redirect('/deals')
}
