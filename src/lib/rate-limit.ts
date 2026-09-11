import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rateLimits } from '@/lib/db/schema'

/**
 * A soft daily cap around AI/external-API calls, so a runaway loop
 * (misbehaving webhook, retried cron, etc.) can't quietly rack up an
 * unbounded API bill. Not meant to be a precise quota system — just a
 * backstop. Reuses the `rate_limits` table from the original scorecard
 * tool; the `ip` column now holds any string key (e.g. `scorecard:<userId>`
 * or `leadclassify:daily`), not literally always an IP.
 */
export async function checkAndIncrementDailyLimit(
  key: string,
  maxPerDay: number
): Promise<{ allowed: boolean; count: number }> {
  const day = new Date().toISOString().slice(0, 10)

  const [existing] = await db
    .select()
    .from(rateLimits)
    .where(and(eq(rateLimits.ip, key), eq(rateLimits.day, day)))
    .limit(1)

  if (!existing) {
    await db.insert(rateLimits).values({ ip: key, day, count: 1 })
    return { allowed: true, count: 1 }
  }

  if (existing.count >= maxPerDay) {
    return { allowed: false, count: existing.count }
  }

  await db.update(rateLimits).set({ count: existing.count + 1 }).where(eq(rateLimits.id, existing.id))
  return { allowed: true, count: existing.count + 1 }
}
