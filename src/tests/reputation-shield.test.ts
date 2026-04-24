import { describe, expect, it } from 'vitest'

import {
  evaluateReputationShield,
  identifyPrimaryChannel,
} from '@/lib/mira/reputation-shield'

describe('Reputation Shield', () => {
  it('identifies the highest revenue channel as primary', () => {
    expect(
      identifyPrimaryChannel([
        { channel: 'google_de', revenue_cents: 12000 },
        { channel: 'amazon_fr', revenue_cents: 38000 },
        { channel: 'amazon_it', revenue_cents: 22000 },
      ])
    ).toBe('amazon_fr')
  })

  it('does nothing while the founder is available', () => {
    expect(
      evaluateReputationShield({
        founderState: 'Available',
        channelRevenue: [
          { channel: 'amazon_fr', revenue_cents: 38000 },
          { channel: 'google_de', revenue_cents: 12000 },
        ],
      })
    ).toBeNull()
  })

  it('plans a governed shield when the founder is away', () => {
    expect(
      evaluateReputationShield({
        founderState: 'Vacation',
        founderReturnsOn: '2026-05-05',
        channelRevenue: [
          { channel: 'google_de', revenue_cents: 12000 },
          { channel: 'amazon_fr', revenue_cents: 38000 },
          { channel: 'amazon_it', revenue_cents: 22000 },
        ],
      })
    ).toEqual({
      actionType: 'reputation_shield',
      status: 'auto_executed',
      templateId: 'reputation_shield_v1',
      primaryChannel: 'amazon_fr',
      secondaryChannels: ['amazon_it', 'google_de'],
      templateInput: {
        primary_channel: 'amazon_fr',
        secondary_channels: ['amazon_it', 'google_de'],
        secondary_channel_count: 2,
        founder_returns_on: '2026-05-05',
      },
    })
  })
})
