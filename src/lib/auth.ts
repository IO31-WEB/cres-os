import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { User } from '@/lib/db/schema'

/**
 * Server-side helper for pages/route handlers that need the local `users`
 * row (role, assignment checks, etc.), not just the Clerk id. Redirects to
 * sign-in if unauthenticated — middleware already guards routes, but this
 * gives a safe fallback for anything called directly (e.g. server actions).
 */
export async function requireUser(): Promise<User> {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user) {
    // Clerk session exists but the webhook hasn't landed yet (race on first
    // sign-up). Rare, but fail loud rather than silently treating them as
    // an unauthenticated visitor.
    throw new Error('User authenticated but not yet synced — retry in a moment.')
  }

  return user
}

export function isOwner(user: User): boolean {
  return user.role === 'owner'
}
