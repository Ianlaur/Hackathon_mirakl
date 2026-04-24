import { describe, expect, it } from 'vitest'

import { buildFounderContext } from '@/lib/mira/founder-context'

describe('FounderContextAgent', () => {
  it('marks vacation as away and applies safety multipliers', () => {
    const context = buildFounderContext({
      state: 'Vacation',
      until: new Date('2026-05-05T00:00:00.000Z'),
    })

    expect(context).toEqual({
      state: 'Vacation',
      until: '2026-05-05T00:00:00.000Z',
      isAway: true,
      queueAllDecisions: true,
      bufferMultiplier: 1.25,
      leadTimeMultiplier: 1.4,
    })
  })

  it('does not queue all decisions while founder is merely off hours', () => {
    const context = buildFounderContext({ state: 'OffHours' })

    expect(context.isAway).toBe(false)
    expect(context.queueAllDecisions).toBe(false)
    expect(context.bufferMultiplier).toBe(1)
    expect(context.leadTimeMultiplier).toBe(1)
  })
})
