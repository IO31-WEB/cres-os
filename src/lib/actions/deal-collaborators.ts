'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals, dealCollaborators } from '@/lib/db/schema'
import { requireUser, isOwner } from '@/lib/auth'

/**
 * Who can manage collaborators on a deal: owners, or the deal's own
 * assigned agent (Susie decides who helps on her deal — not a random
 * other agent who happens to already be a collaborator).
 */
async function assertCanManageCollaborators(user: Awaited<ReturnType<typeof requireUser>>, dealId: number) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!deal) throw new Error('Deal not found')
  if (isOwner(user) || deal.assignedToUserId === user.id) return deal
  throw new Error('Only the assigned agent or an owner can manage collaborators on this deal.')
}

export async function addDealCollaborator(dealId: number, collaboratorUserId: string): Promise<void> {
  const user = await requireUser()
  await assertCanManageCollaborators(user, dealId)

  await db.insert(dealCollaborators).values({ dealId, userId: collaboratorUserId, addedByUserId: user.id }).onConflictDoNothing()
  revalidatePath(`/deals/${dealId}`)
}

export async function removeDealCollaborator(dealId: number, collaboratorUserId: string): Promise<void> {
  const user = await requireUser()
  await assertCanManageCollaborators(user, dealId)

  await db
    .delete(dealCollaborators)
    .where(and(eq(dealCollaborators.dealId, dealId), eq(dealCollaborators.userId, collaboratorUserId)))
  revalidatePath(`/deals/${dealId}`)
}
