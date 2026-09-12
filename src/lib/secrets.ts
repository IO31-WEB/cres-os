import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison for shared-secret checks (cron auth,
 * lead-intake auth, etc.) — a plain `===` comparison on a secret leaks
 * timing information proportional to how many leading characters match,
 * which is a real (if hard-to-exploit-remotely) attack surface for a bare
 * bearer-token check. `crypto.timingSafeEqual` requires equal-length
 * buffers, so length is checked separately in a way that doesn't
 * short-circuit the rest of the comparison.
 */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Still run a same-length comparison so this branch takes roughly the
    // same time as the equal-length case, rather than returning instantly.
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}
