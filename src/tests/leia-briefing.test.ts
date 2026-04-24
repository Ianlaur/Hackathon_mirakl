import { describe, expect, it } from 'vitest'
import { buildBriefing } from '@/lib/leia/briefing'

describe('buildBriefing', () => {
  const metrics = {
    pendingApprovals: 3,
    queuedDecisions: 2,
    lowStockSkus: 5,
    nextEventTitle: 'Black Friday',
    nextEventDate: '2026-11-27',
  }

  it('builds an English briefing', () => {
    const briefing = buildBriefing({
      language: 'en',
      metrics,
      now: new Date('2026-04-24T08:00:00.000Z'),
    })

    expect(briefing.headline).toBe('Morning briefing')
    expect(briefing.lines[0]).toContain('Pending approvals: 3')
    expect(briefing.lines[3]).toContain('Black Friday on 2026-11-27')
  })

  it('builds a French briefing', () => {
    const briefing = buildBriefing({
      language: 'fr',
      metrics,
      now: new Date('2026-04-24T08:00:00.000Z'),
    })

    expect(briefing.headline).toBe('Briefing du matin')
    expect(briefing.lines[0]).toContain('Pending approvals : 3')
    expect(briefing.lines[3]).toContain('Black Friday le 2026-11-27')
  })

  it('handles an empty upcoming event gracefully', () => {
    const briefing = buildBriefing({
      language: 'de',
      metrics: {
        ...metrics,
        nextEventTitle: null,
        nextEventDate: null,
      },
      now: new Date('2026-04-24T08:00:00.000Z'),
    })

    expect(briefing.lines[3]).toContain('keines geplant')
  })
})
