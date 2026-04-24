type Bucket = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  limit: number
  windowMs: number
  now?: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = options.now ?? Date.now()
  const limit = Math.max(1, options.limit)
  const windowMs = Math.max(1, options.windowMs)
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + windowMs,
    }
    buckets.set(key, next)

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: next.resetAt,
    }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
    }
  }

  bucket.count += 1

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  }
}

export function resetRateLimitBuckets() {
  buckets.clear()
}
