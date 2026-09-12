import { describe, it, expect } from 'vitest'
import { secretsMatch } from '@/lib/secrets'

describe('secretsMatch', () => {
  it('returns true for an exact match', () => {
    expect(secretsMatch('correct-secret-123', 'correct-secret-123')).toBe(true)
  })

  it('returns false for a mismatch', () => {
    expect(secretsMatch('wrong-secret', 'correct-secret-123')).toBe(false)
  })

  it('returns false for a different-length near-match (no early exit)', () => {
    expect(secretsMatch('correct-secret-12', 'correct-secret-123')).toBe(false)
  })

  it('returns false for null/undefined input rather than throwing', () => {
    expect(secretsMatch(null, 'correct-secret-123')).toBe(false)
    expect(secretsMatch(undefined, 'correct-secret-123')).toBe(false)
  })

  it('returns false for an empty string against a non-empty secret', () => {
    expect(secretsMatch('', 'correct-secret-123')).toBe(false)
  })
})
