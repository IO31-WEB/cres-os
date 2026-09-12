/**
 * Translates raw Postgres errors (via @neondatabase/serverless's
 * NeonDbError) into safe, user-facing messages. Never let a raw DB error
 * — constraint names, column names, SQL fragments — reach the client;
 * log the original server-side and return something a person can act on.
 */

interface PgErrorLike {
  code?: string
  constraint?: string
  message?: string
  table?: string
  column?: string
}

function asPgError(err: unknown): PgErrorLike | undefined {
  if (err && typeof err === 'object' && 'code' in err) return err as PgErrorLike
  return undefined
}

export function isForeignKeyViolation(err: unknown): boolean {
  return asPgError(err)?.code === '23503'
}

export function isUniqueViolation(err: unknown): boolean {
  return asPgError(err)?.code === '23505'
}

export function isCheckViolation(err: unknown): boolean {
  return asPgError(err)?.code === '23514'
}

/**
 * Runs a delete (or any mutation) and converts known constraint
 * violations into a friendly message instead of letting Next.js's default
 * error boundary show a raw/opaque failure. Logs the real error
 * server-side either way.
 */
export async function runDeleteOrFriendlyError<T>(fn: () => Promise<T>, friendlyMessage: string): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error('Delete failed', err)
    if (isForeignKeyViolation(err)) {
      throw new Error(friendlyMessage)
    }
    throw new Error('Something went wrong completing that action. Please try again.')
  }
}
