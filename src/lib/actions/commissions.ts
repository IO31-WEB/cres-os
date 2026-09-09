'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { commissions } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'
import { commissionSchema } from '@/lib/validations/commission'
import { parseForm, type ActionState } from '@/lib/actions/form-state'

export async function createCommission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser()
  const parsed = parseForm(commissionSchema, formData)
  if (!parsed.success) return parsed.state

  const d = parsed.data
  await db.insert(commissions).values({
    dealId: Number(d.dealId),
    expectedAmount: Number(d.expectedAmount),
    invoicedAmount: d.invoicedAmount ? Number(d.invoicedAmount) : null,
    collectedAmount: d.collectedAmount ? Number(d.collectedAmount) : null,
    status: d.status,
    dueDate: d.dueDate ? new Date(d.dueDate) : null,
    invoicedAt: d.status === 'invoiced' || d.status === 'overdue' ? new Date() : null,
    collectedAt: d.status === 'collected' ? new Date() : null,
  })

  revalidatePath('/commissions')
  revalidatePath(`/deals/${d.dealId}`)
  redirect('/commissions')
}

export async function updateCommission(
  commissionId: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()
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

  revalidatePath('/commissions')
  revalidatePath(`/deals/${d.dealId}`)
  redirect('/commissions')
}

export async function deleteCommission(commissionId: number, dealId: number): Promise<void> {
  await requireUser()
  await db.delete(commissions).where(eq(commissions.id, commissionId))
  revalidatePath('/commissions')
  revalidatePath(`/deals/${dealId}`)
  redirect('/commissions')
}
