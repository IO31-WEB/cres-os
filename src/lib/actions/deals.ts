'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { dealSchema } from '@/lib/validations/deal'
import { parseForm, type ActionState } from '@/lib/actions/form-state'
import { isValidStage, defaultStage } from '@/lib/pipelines'

function orNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null
}

export async function createDeal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(dealSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const [created] = await db
    .insert(deals)
    .values({
      name: d.name,
      pipeline: d.pipeline,
      stage: d.stage || defaultStage(d.pipeline),
      contactId: d.contactId ? Number(d.contactId) : null,
      companyId: d.companyId ? Number(d.companyId) : null,
      propertyId: d.propertyId ? Number(d.propertyId) : null,
      value: d.value ? Number(d.value) : null,
      probability: d.probability !== '' && d.probability !== undefined ? Number(d.probability) : null,
      ndaStatus: d.ndaStatus,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
      assignedToUserId: orNull(d.assignedToUserId) ?? user.id,
    })
    .returning({ id: deals.id })

  revalidatePath('/deals')
  redirect(`/deals/${created.id}`)
}

export async function updateDeal(dealId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser()
  const parsed = parseForm(dealSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  await db
    .update(deals)
    .set({
      name: d.name,
      pipeline: d.pipeline,
      stage: d.stage,
      contactId: d.contactId ? Number(d.contactId) : null,
      companyId: d.companyId ? Number(d.companyId) : null,
      propertyId: d.propertyId ? Number(d.propertyId) : null,
      value: d.value ? Number(d.value) : null,
      probability: d.probability !== '' && d.probability !== undefined ? Number(d.probability) : null,
      ndaStatus: d.ndaStatus,
      expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
      assignedToUserId: orNull(d.assignedToUserId),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    })
    .where(eq(deals.id, dealId))

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
  redirect(`/deals/${dealId}`)
}

export async function updateDealStage(dealId: number, pipeline: string, newStage: string): Promise<void> {
  await requireUser()
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
  await requireUser()
  await db
    .update(deals)
    .set({ status, lostReason: status === 'lost' ? (lostReason ?? null) : null, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(deals.id, dealId))

  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)
}

export async function deleteDeal(dealId: number): Promise<void> {
  await requireUser()
  await db.delete(deals).where(eq(deals.id, dealId))
  revalidatePath('/deals')
  redirect('/deals')
}
