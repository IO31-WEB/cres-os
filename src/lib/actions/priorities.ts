'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyPriorities } from '@/lib/db/schema'
import { requireUser, isOwner } from '@/lib/auth'

export async function dismissPriority(priorityId: number): Promise<void> {
  const user = await requireUser()

  // A priority card is generated for a specific user (for_user_id) — never
  // let one user's request dismiss another user's card by guessing/
  // iterating ids. Owners can also dismiss on anyone's behalf (parity with
  // their blanket visibility elsewhere).
  const [priority] = await db.select().from(dailyPriorities).where(eq(dailyPriorities.id, priorityId)).limit(1)
  if (!priority) return
  if (!isOwner(user) && priority.forUserId !== user.id) {
    throw new Error('You can only dismiss your own priorities.')
  }

  await db
    .update(dailyPriorities)
    .set({ dismissed: true })
    .where(and(eq(dailyPriorities.id, priorityId)))
  revalidatePath('/dashboard')
}
