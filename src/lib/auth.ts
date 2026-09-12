import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { provisionUser } from '@/lib/user-provisioning'
import type { User } from '@/lib/db/schema'

/**
 * Server-side helper for pages/route handlers that need the local `users`
 * row (role, assignment checks, etc.), not just the Clerk id. Redirects to
 * sign-in if unauthenticated — middleware already guards routes, but this
 * gives a safe fallback for anything called directly (e.g. server actions).
 *
 * Self-healing: the Clerk webhook (api/webhooks/clerk) is the normal path
 * for creating this row, but if it's misconfigured, delayed, or simply
 * hasn't been set up yet, this falls back to creating the row directly
 * from the active Clerk session instead of leaving the person stuck on an
 * error page. The webhook keeps the row updated afterward as usual.
 */
export async function requireUser(): Promise<User> {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (existing) return existing

  const clerkUser = await currentUser()
  if (!clerkUser) {
    redirect('/sign-in')
  }

  const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    primaryEmail?.emailAddress ||
    'Unnamed'

  // Race-safe first-owner assignment — see lib/user-provisioning.ts for why
  // this isn't a plain "select count, then insert".
  return provisionUser({
    id: userId,
    email: primaryEmail?.emailAddress ?? '',
    name,
    imageUrl: clerkUser.imageUrl ?? null,
  })
}

export function isOwner(user: User): boolean {
  return user.role === 'owner'
}
