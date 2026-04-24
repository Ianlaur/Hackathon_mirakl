import { describe, expect, it } from 'vitest'

import { checkRateLimit, resetRateLimitBuckets } from '@/lib/leia/rate-limit'

describe('Leia route rate limiter', () => {
  it('allows requests until the configured limit is reached', () => {
    resetRateLimitBuckets()

    expect(checkRateLimit('user-1', { limit: 2, windowMs: 1000, now: 100 })).toMatchObject({
      allowed: true,
      remaining: 1,
    })
    expect(checkRateLimit('user-1', { limit: 2, windowMs: 1000, now: 200 })).toMatchObject({
      allowed: true,
      remaining: 0,
    })
    expect(checkRateLimit('user-1', { limit: 2, windowMs: 1000, now: 300 })).toMatchObject({
      allowed: false,
      remaining: 0,
    })
  })

  it('resets after the window expires', () => {
    resetRateLimitBuckets()

    checkRateLimit('user-1', { limit: 1, windowMs: 1000, now: 100 })

    expect(checkRateLimit('user-1', { limit: 1, windowMs: 1000, now: 1200 })).toMatchObject({
      allowed: true,
      remaining: 0,
    })
  })
})
