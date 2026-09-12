import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rateLimits } from '@/lib/db/schema'

/**
 * A daily cap around AI/external-API calls and other abuse-prone
 * endpoints, so a runaway loop (misbehaving webhook, retried cron,
 * scripted abuse) can't quietly rack up an unbounded bill or request
 * volume. Reuses the `rate_limits` table from the original scorecard tool;
 * the `ip` column now holds any string key (e.g. `scorecard:<userId>` or
 * `leadclassify:daily`), not literally always an IP.
 *
 * This is a single atomic `INSERT ... ON CONFLICT ... WHERE ... RETURNING`
 * rather than the previous "SELECT count, check limit, UPDATE count" —
 * that pattern has a classic TOCTOU race: two concurrent requests can both
 * read the same count before either writes, both see themselves as under
 * the limit, and both proceed, letting the cap be exceeded under load.
 * Here, Postgres itself evaluates the WHERE condition against the current
 * row as part of the same statement that increments it — if the condition
 * is false, the UPDATE simply doesn't happen and RETURNING yields no rows,
 * with no window for another request to interleave. This requires the
 * unique index on (ip, day) added in drizzle/0005_security_hardening_v2.sql.
 */
export async function checkAndIncrementDailyLimit(
  key: string,
  maxPerDay: number
): Promise<{ allowed: boolean; count: number }> {
  const day = new Date().toISOString().slice(0, 10)

  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (ip, day, count)
    VALUES (${key}, ${day}, 1)
    ON CONFLICT (ip, day) DO UPDATE
      SET count = rate_limits.count + 1
      WHERE rate_limits.count < ${maxPerDay}
    RETURNING count
  `)

  const row = result.rows[0]
  if (row) {
    return { allowed: true, count: Number(row.count) }
  }

  // No row returned means the conflict's WHERE clause was false — already
  // at/over the cap. Read back the current count purely for the response
  // message; this read is not part of the enforcement decision.
  const [current] = await db
    .select()
    .from(rateLimits)
    .where(and(eq(rateLimits.ip, key), eq(rateLimits.day, day)))
    .limit(1)

  return { allowed: false, count: current?.count ?? maxPerDay }
}
