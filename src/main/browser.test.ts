import { describe, expect, it } from 'vitest'
import { isLoggedIn } from './browser'

describe('isLoggedIn', () => {
  const now = Date.parse('2026-10-20T14:00:00Z')
  const inAMonth = Date.parse('2026-11-19T14:11:33Z')

  it('counts a refresh token as logged in, even with the access token expired', () => {
    expect(isLoggedIn({ access: true, refresh: true, expires: now - 1000 }, now)).toBe(true)
    expect(isLoggedIn({ access: false, refresh: true, expires: 0 }, now)).toBe(true)
  })

  it('counts an access token only until it expires', () => {
    expect(isLoggedIn({ access: true, refresh: false, expires: inAMonth }, now)).toBe(true)
    expect(isLoggedIn({ access: true, refresh: false, expires: now - 1000 }, now)).toBe(false)
    expect(isLoggedIn({ access: true, refresh: false, expires: 0 }, now)).toBe(false)
  })

  it('is logged out with no tokens', () => {
    expect(isLoggedIn({ access: false, refresh: false, expires: inAMonth }, now)).toBe(false)
  })
})
