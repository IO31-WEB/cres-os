'use server'

import { revalidatePath } from 'next/cache'
import { eq, ne, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireUser, isOwner } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db/errors'

export async function updateUserRole(targetUserId: string, role: 'owner' | 'agent'): Promise<void> {
  const currentUser = await requireUser()
  if (!isOwner(currentUser)) {
    throw new Error('Only owners can change roles.')
  }

  const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)
  if (!target) throw new Error('User not found.')

  // Guard against locking everyone out of owner-only settings: don't allow
  // demoting the last remaining owner (including demoting yourself if
  // you're the only one).
  if (target.role === 'owner' && role === 'agent') {
    const [otherOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'owner'), ne(users.id, targetUserId)))
      .limit(1)
    if (!otherOwner) {
      throw new Error('At least one owner is required — promote another user to owner first.')
    }
  }

  try {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, targetUserId))
  } catch (err) {
    // Promoting a second person to 'owner' while one already exists hits
    // the same single-owner partial unique index the signup flow relies
    // on (see lib/user-provisioning.ts) — translate it into plain language.
    if (isUniqueViolation(err)) {
      throw new Error('There is already an owner. Demote the current owner to agent first.')
    }
    throw err
  }

  await logAudit({
    user: currentUser,
    action: 'user.role_change',
    entityType: 'user',
    entityId: targetUserId,
    metadata: { from: target.role, to: role },
  })

  revalidatePath('/settings')
}
