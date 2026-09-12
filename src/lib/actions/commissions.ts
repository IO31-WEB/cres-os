'use server'

import { revalidatePath } from 'next/cache'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { commissions, deals } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { commissionSchema } from '@/lib/validations/commission'
import { parseForm, type ActionState } from '@/lib/actions/form-state'
import { canViewDeal, canViewCommission } from '@/lib/visibility'
import { logAuditBestEffort } from '@/lib/audit'

export async function createCommission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseForm(commissionSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  const dealId = Number(d.dealId)
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!deal || !(await canViewDeal(user, deal))) notFound()

  const [created] = await db
    .insert(commissions)
    .values({
      dealId,
      expectedAmount: Number(d.expectedAmount),
      invoicedAmount: d.invoicedAmount ? Number(d.invoicedAmount) : null,
      collectedAmount: d.collectedAmount ? Number(d.collectedAmount) : null,
      status: d.status,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      invoicedAt: d.status === 'invoiced' || d.status === 'overdue' ? new Date() : null,
      collectedAt: d.status === 'collected' ? new Date() : null,
    })
    .returning({ id: commissions.id })

  await logAuditBestEffort({ user, action: 'commission.create', entityType: 'commission', entityId: created.id, metadata: { dealId } })

  revalidatePath('/commissions')
  revalidatePath(`/deals/${dealId}`)
  redirect('/commissions')
}

export async function updateCommission(
  commissionId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser()
  const [existing] = await db.select().from(commissions).where(eq(commissions.id, commissionId)).limit(1)
  if (!existing || !(await canViewCommission(user, existing))) notFound()

  const parsed = parseForm(commissionSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  await db
    .update(commissions)
    .set({
      expectedAmount: Number(d.expectedAmount),
      invoicedAmount: d.invoicedAmount ? Number(d.invoicedAmount) : null,
      collectedAmount: d.collectedAmount ? Number(d.collectedAmount) : null,
      status: d.status,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      updatedAt: new Date(),
    })
    .where(eq(commissions.id, commissionId))

  await logAuditBestEffort({
    user,
    action: 'commission.update',
    entityType: 'commission',
    entityId: commissionId,
    metadata: { status: d.status },
  })

  revalidatePath('/commissions')
  revalidatePath(`/deals/${d.dealId}`)
  redirect('/commissions')
}

export async function deleteCommission(commissionId: number, dealId: number): Promise<void> {
  const user = await requireUser()
  const [existing] = await db.select().from(commissions).where(eq(commissions.id, commissionId)).limit(1)
  if (!existing || !(await canViewCommission(user, existing))) notFound()

  await db.delete(commissions).where(eq(commissions.id, commissionId))
  await logAuditBestEffort({ user, action: 'commission.delete', entityType: 'commission', entityId: commissionId, metadata: { dealId } })
  revalidatePath('/commissions')
  revalidatePath(`/deals/${dealId}`)
  redirect('/commissions')
}
