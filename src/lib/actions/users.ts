'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireUser, isOwner } from '@/lib/auth'

export async function updateUserRole(targetUserId: string, role: 'owner' | 'agent'): Promise<void> {
  const currentUser = await requireUser()
  if (!isOwner(currentUser)) {
    throw new Error('Only owners can change roles.')
  }

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, targetUserId))
  revalidatePath('/settings')
}
