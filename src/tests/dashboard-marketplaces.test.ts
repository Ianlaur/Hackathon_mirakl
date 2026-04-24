import { describe, expect, it } from 'vitest'
import {
  buildDashboardHistoryMessage,
  selectDashboardRecommendations,
} from '@/lib/dashboard'
import {
  acceptMarketplaceProposal,
  buildActiveConnectionHref,
  declineMarketplaceProposal,
  pickConversationName,
} from '@/lib/marketplaces'

describe('selectDashboardRecommendations', () => {
  it('prioritizes pending recommendations and caps the result size', () => {
    const recommendations = [
      {
        id: 'approved-old',
        title: 'Approved',
        scenario_type: 'pricing',
        status: 'approved',
        reasoning_summary: 'already handled',
        created_at: '2026-04-20T08:00:00.000Z',
      },
      {
        id: 'pending-old',
        title: 'Pending old',
        scenario_type: 'restock_plan_manual',
        status: 'pending_approval',
        reasoning_summary: 'older pending',
        created_at: '2026-04-21T08:00:00.000Z',
      },
      {
        id: 'pending-new',
        title: 'Pending new',
        scenario_type: 'pricing',
        status: 'pending_approval',
        reasoning_summary: 'newer pending',
        created_at: '2026-04-22T08:00:00.000Z',
      },
      {
        id: 'rejected-new',
        title: 'Rejected',
        scenario_type: 'ops',
        status: 'rejected',
        reasoning_summary: 'rejected',
        created_at: '2026-04-23T08:00:00.000Z',
      },
    ]

    expect(selectDashboardRecommendations(recommendations, 2).map((item) => item.id)).toEqual([
      'pending-new',
      'pending-old',
    ])
  })

  it('excludes non-pending decisions from the dashboard queue', () => {
    const recommendations = [
      {
        id: 'approved',
        title: 'Approved',
        scenario_type: 'pricing',
        status: 'approved',
        reasoning_summary: 'already handled',
        created_at: '2026-04-20T08:00:00.000Z',
      },
      {
        id: 'rejected',
        title: 'Rejected',
        scenario_type: 'restock_plan_manual',
        status: 'rejected',
        reasoning_summary: 'already handled',
        created_at: '2026-04-21T08:00:00.000Z',
      },
    ]

    expect(selectDashboardRecommendations(recommendations, 2)).toEqual([])
  })

  it('builds a Leia history message when a dashboard decision is handled', () => {
    expect(
      buildDashboardHistoryMessage(
        {
          title: 'Calendar restock plan',
          scenario_type: 'restock_plan_manual',
        },
        'approve'
      )
    ).toEqual({
      content: 'Leia marked "Calendar restock plan" as approved.',
      reasoningSummary: 'History updated | restock plan manual | approved',
    })
  })
})

describe('marketplace helpers', () => {
  it('accepts a proposal by moving it to connected channels and removing it from proposals', () => {
    const proposals = [
      { name: 'Darty', category: 'Electronics', dailyUsers: '2.4M', revenue: 'â‚¬850M' },
      { name: 'Carrefour', category: 'Retail', dailyUsers: '4.8M', revenue: 'â‚¬1.2B' },
    ]
    const connected = [
      { name: 'Amazon', revenue: 'â‚¬42,000', change: '+12.4%', status: 'STABLE' as const, icon: 'AMZ' },
    ]

    const result = acceptMarketplaceProposal(proposals, connected, 'Darty')

    expect(result.proposals.map((proposal) => proposal.name)).toEqual(['Carrefour'])
    expect(result.connected.map((channel) => channel.name)).toEqual(['Amazon', 'Darty'])
  })

  it('declines a proposal by removing it from the visible list', () => {
    const proposals = [
      { name: 'Darty', category: 'Electronics', dailyUsers: '2.4M', revenue: 'â‚¬850M' },
      { name: 'Carrefour', category: 'Retail', dailyUsers: '4.8M', revenue: 'â‚¬1.2B' },
    ]

    expect(declineMarketplaceProposal(proposals, 'Carrefour').map((proposal) => proposal.name)).toEqual(['Darty'])
  })

  it('builds a partner-aware channel URL and selects a safe fallback conversation', () => {
    expect(buildActiveConnectionHref('Maisons du Monde')).toBe(
      '/marketplaces/active-connection?partner=Maisons%20du%20Monde'
    )

    expect(pickConversationName('Unknown', ['Darty', 'Carrefour'])).toBe('Darty')
    expect(pickConversationName('Carrefour', ['Darty', 'Carrefour'])).toBe('Carrefour')
  })
})
