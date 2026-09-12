import { describe, it, expect } from 'vitest'
import { sanitizeFileName, contentDisposition } from '@/lib/r2'

describe('sanitizeFileName', () => {
  it('strips path separators (defense against path traversal in the display name)', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('/')
    expect(sanitizeFileName('..\\..\\windows\\system32')).not.toContain('\\')
  })

  it('strips control characters', () => {
    const withControlChars = 'file\x00name\x1f.pdf'
    const result = sanitizeFileName(withControlChars)
    // eslint-disable-next-line no-control-regex
    expect(/[\x00-\x1f\x7f]/.test(result)).toBe(false)
  })

  it('caps length', () => {
    const long = 'a'.repeat(500) + '.pdf'
    expect(sanitizeFileName(long).length).toBeLessThanOrEqual(200)
  })

  it('falls back to a default name if nothing survives sanitization', () => {
    // Only control characters (no path separators) — sanitizeFileName
    // replaces separators with '_' (so '///' becomes a non-empty '___',
    // which is fine — collisions are handled elsewhere by the random
    // object key), but strips control characters outright, so an
    // input made entirely of them should hit the empty-string fallback.
    expect(sanitizeFileName('\x00\x01\x02')).toBe('document')
  })

  it('leaves an ordinary filename untouched', () => {
    expect(sanitizeFileName('Purchase Agreement.pdf')).toBe('Purchase Agreement.pdf')
  })
})

describe('contentDisposition', () => {
  it('produces both an ASCII fallback and an RFC 5987 extended form', () => {
    const header = contentDisposition('report.pdf')
    expect(header).toContain('filename="report.pdf"')
    expect(header).toContain("filename*=UTF-8''report.pdf")
  })

  it('never leaves a raw double-quote in the ASCII fallback (would break the quoted-string)', () => {
    const header = contentDisposition('quote"injection.pdf')
    const fallbackMatch = header.match(/filename="([^]*?)"; filename\*=/)
    expect(fallbackMatch).not.toBeNull()
    expect(fallbackMatch![1]).not.toContain('"')
  })

  it('never leaves a raw backslash in the ASCII fallback', () => {
    const header = contentDisposition('back\\slash.pdf')
    const fallbackMatch = header.match(/filename="([^]*?)"; filename\*=/)
    expect(fallbackMatch![1]).not.toContain('\\')
  })

  it('strips CR/LF entirely — defense in depth against HTTP header-splitting', () => {
    // The literal text of an injection attempt is harmless once the CR/LF
    // bytes that would start a new header line are gone — it just becomes
    // part of an odd-looking (but inert) filename. What matters is that no
    // \r or \n byte survives into the header value.
    const malicious = 'evil.pdf\r\nX-Injected-Header: pwned'
    const header = contentDisposition(malicious)
    expect(header).not.toContain('\r')
    expect(header).not.toContain('\n')
  })

  it('correctly round-trips a Unicode filename via the extended form', () => {
    const header = contentDisposition('résumé—señor.pdf')
    const extendedMatch = header.match(/filename\*=UTF-8''(.+)$/)
    expect(extendedMatch).not.toBeNull()
    const decoded = decodeURIComponent(extendedMatch![1])
    expect(decoded).toBe('résumé—señor.pdf')
  })

  it('replaces non-ASCII characters in the fallback rather than corrupting the header', () => {
    const header = contentDisposition('日本語のファイル.pdf')
    const fallbackMatch = header.match(/filename="([^]*?)"; filename\*=/)
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7e]*$/.test(fallbackMatch![1])).toBe(true)
  })

  it('does not throw or produce a malformed header for a semicolon in the name', () => {
    const header = contentDisposition('a;b.pdf')
    expect(header.startsWith('attachment; filename=')).toBe(true)
  })
})
