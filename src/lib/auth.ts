import { auth, currentUser } from '@clerk/nextjs/server'
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

  // First user ever created becomes the owner, same rule the webhook uses.
  const anyExistingUser = await db.select({ id: users.id }).from(users).limit(1)
  const role = anyExistingUser.length > 0 ? 'agent' : 'owner'

  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      email: primaryEmail?.emailAddress ?? '',
      name,
      imageUrl: clerkUser.imageUrl ?? null,
      role,
    })
    // If the webhook fires a split second later and races this insert, keep
    // whichever row won rather than erroring on the unique id conflict.
    .onConflictDoNothing({ target: users.id })
    .returning()

  if (created) return created

  const [afterRace] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return afterRace
}

export function isOwner(user: User): boolean {
  return user.role === 'owner'
}
