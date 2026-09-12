import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

/**
 * These tests exercise the actual Postgres constraint added in
 * drizzle/0005_security_hardening_v2.sql (the partial unique index behind
 * the first-owner fix, and the unique index behind the atomic rate
 * limiter) directly via `pg`, independent of the app's neon-http driver
 * wrapper. That's deliberate: the fix is a database-level invariant, so
 * the test proves the invariant holds under real concurrent transactions
 * rather than mocking around the thing being tested.
 *
 * Requires TEST_DATABASE_URL (a scratch Postgres database with migrations
 * 0000–0005 already applied — see README / CI config). Skips cleanly if
 * that isn't set, since most environments won't have a disposable
 * Postgres instance wired up for local `npm test` runs.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip

describeIfDb('first-owner race condition (real concurrency, real Postgres)', () => {
  let pool: Pool

  beforeAll(() => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`DELETE FROM users WHERE id LIKE 'test_race_%'`)
  })

  async function tryInsertOwner(id: string): Promise<'owner' | 'agent'> {
    try {
      await pool.query(
        `INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, 'owner')`,
        [id, `${id}@example.com`, id]
      )
      return 'owner'
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string }
      if (pgErr.code === '23505' && pgErr.constraint === 'users_single_owner_idx') {
        await pool.query(`INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, 'agent')`, [
          id,
          `${id}@example.com`,
          id,
        ])
        return 'agent'
      }
      throw err
    }
  }

  it('allows exactly one owner when 10 signups race simultaneously', async () => {
    const ids = Array.from({ length: 10 }, () => `test_race_${randomUUID()}`)

    // The whole point: fire every insert attempt at once, with no
    // coordination between them, exactly like 10 concurrent serverless
    // invocations would. Before the partial unique index, this reliably
    // produced multiple 'owner' rows.
    const results = await Promise.all(ids.map((id) => tryInsertOwner(id)))

    const owners = results.filter((r) => r === 'owner')
    expect(owners.length).toBe(1)

    const { rows } = await pool.query(`SELECT role FROM users WHERE id = ANY($1) AND role = 'owner'`, [ids])
    expect(rows.length).toBe(1)
  })

  it('rejects a second owner even in strict sequence (not just under concurrency)', async () => {
    const idA = `test_race_${randomUUID()}`
    const idB = `test_race_${randomUUID()}`

    const first = await tryInsertOwner(idA)
    const second = await tryInsertOwner(idB)

    expect(first).toBe('owner')
    expect(second).toBe('agent')
  })
})

describeIfDb('atomic rate limiter (real concurrency, real Postgres)', () => {
  let pool: Pool

  beforeAll(() => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
  })

  afterAll(async () => {
    await pool.end()
  })

  const key = `test_rl_${randomUUID()}`
  const day = new Date().toISOString().slice(0, 10)

  afterAll(async () => {
    await pool.query(`DELETE FROM rate_limits WHERE ip = $1`, [key])
  })

  async function checkAndIncrement(maxPerDay: number): Promise<boolean> {
    const result = await pool.query(
      `INSERT INTO rate_limits (ip, day, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (ip, day) DO UPDATE
         SET count = rate_limits.count + 1
         WHERE rate_limits.count < $3
       RETURNING count`,
      [key, day, maxPerDay]
    )
    return result.rows.length > 0
  }

  it('never allows more than maxPerDay successes under 50 concurrent requests (cap = 10)', async () => {
    const maxPerDay = 10
    const concurrency = 50

    // This is the exact scenario the old "SELECT count, check, UPDATE"
    // implementation could not survive: every one of these 50 requests
    // starts before any of the others has written its result.
    const results = await Promise.all(Array.from({ length: concurrency }, () => checkAndIncrement(maxPerDay)))

    const allowedCount = results.filter(Boolean).length
    expect(allowedCount).toBe(maxPerDay)

    const { rows } = await pool.query(`SELECT count FROM rate_limits WHERE ip = $1 AND day = $2`, [key, day])
    expect(rows[0].count).toBe(maxPerDay)
  })
})
