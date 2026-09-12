import 'server-only'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { User } from '@/lib/db/schema'

/**
 * Creates (or fetches) a local `users` row for a given Clerk user, deciding
 * 'owner' vs 'agent' in a way that's safe under concurrency and across
 * multiple serverless instances.
 *
 * Why this isn't just "select count, then insert": that pattern has a
 * classic TOCTOU race — two signups landing on two different Lambda/Edge
 * instances (or even the same instance handling two requests concurrently)
 * can both run the "any existing user?" SELECT before either INSERT lands,
 * both see zero rows, and both insert themselves as 'owner'. There's no
 * app-level lock that closes that window in a serverless/HTTP-only-driver
 * environment (no long-lived connection to hold an advisory lock on).
 *
 * Instead, the *database* enforces the invariant: `users_single_owner_idx`
 * is a partial unique index on `role` WHERE role = 'owner' (see
 * drizzle/0005_security_hardening_v2.sql), so Postgres itself rejects a
 * second 'owner' row even if two inserts race at the exact same instant.
 * The logic here just reacts to that:
 *   1. Optimistically try to insert as 'owner' if we believe no one exists.
 *   2. If Postgres rejects it because someone already claimed 'owner',
 *      retry as 'agent'.
 *   3. If a webhook (or a concurrent call for the same person) already
 *      created this exact user id, `onConflictDoNothing` on the id no-ops
 *      and we just read back whichever row won.
 *
 * Used by both lib/auth.ts (self-healing session fallback) and the Clerk
 * webhook handler, so both paths are equally race-safe.
 */
export async function provisionUser(input: {
  id: string
  email: string
  name: string
  imageUrl: string | null
}): Promise<User> {
  const anyExistingUser = await db.select({ id: users.id }).from(users).limit(1)
  const desiredRole = anyExistingUser.length > 0 ? 'agent' : 'owner'

  const inserted = await tryInsert(input, desiredRole)
  if (inserted) return inserted

  // Either the id already existed (webhook/race beat us to this exact
  // user), or — if we attempted 'owner' — someone else already claimed the
  // single-owner slot. Distinguish by re-reading.
  const [existing] = await db.select().from(users).where(eq(users.id, input.id)).limit(1)
  if (existing) return existing

  // Row still doesn't exist, so it must have been the owner-slot conflict.
  // Retry once as 'agent' — this can only be reached when desiredRole was
  // 'owner' and lost the race, since an 'agent' insert never conflicts on
  // the partial unique index.
  const retried = await tryInsert(input, 'agent')
  if (retried) return retried

  // Extremely unlikely (would mean another id-conflict raced in between),
  // but fall back to a final read rather than throwing.
  const [afterRetry] = await db.select().from(users).where(eq(users.id, input.id)).limit(1)
  if (!afterRetry) {
    throw new Error(`provisionUser: could not create or find user row for ${input.id}`)
  }
  return afterRetry
}

async function tryInsert(
  input: { id: string; email: string; name: string; imageUrl: string | null },
  role: 'owner' | 'agent'
): Promise<User | undefined> {
  try {
    const [created] = await db
      .insert(users)
      .values({
        id: input.id,
        email: input.email,
        name: input.name,
        imageUrl: input.imageUrl,
        role,
      })
      // Same Clerk user racing itself (e.g. webhook + session fallback
      // firing back-to-back) — keep whichever insert won, don't error.
      .onConflictDoNothing({ target: users.id })
      .returning()
    return created
  } catch (err) {
    if (role === 'owner' && isSingleOwnerViolation(err)) {
      // Someone else's insert won the single-owner slot between our
      // read and our insert — expected under concurrency, not a bug.
      return undefined
    }
    throw err
  }
}

/** Postgres unique_violation (23505) on the users_single_owner_idx index. */
function isSingleOwnerViolation(err: unknown): boolean {
  const pgErr = err as { code?: string; constraint?: string; message?: string } | undefined
  if (!pgErr) return false
  if (pgErr.code !== '23505') return false
  return (
    pgErr.constraint === 'users_single_owner_idx' ||
    (typeof pgErr.message === 'string' && pgErr.message.includes('users_single_owner_idx'))
  )
}
