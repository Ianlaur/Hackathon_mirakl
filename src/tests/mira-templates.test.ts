import { describe, expect, it } from 'vitest'

import {
  MIRA_TEMPLATE_IDS,
  renderTemplate,
  TEMPLATE_REGISTRY,
} from '@/lib/mira/templates'

describe('MIRA template registry', () => {
  it('registers all 15 decision templates', () => {
    expect(MIRA_TEMPLATE_IDS).toEqual([
      'buffer_adjustment_v1',
      'calendar_posture_v1',
      'carrier_audit_v1',
      'fuse_tripped_v1',
      'listing_pause_v1',
      'listing_resume_v1',
      'oversell_risk_v1',
      'reconciliation_variance_v1',
      'reputation_shield_v1',
      'restock_proposal_v1',
      'returns_pattern_v1',
      'seasonal_prediction_v1',
      'supplier_loss_v1',
      'supplier_scorecard_v1',
      'vacation_queue_v1',
    ])

    expect(Object.keys(TEMPLATE_REGISTRY).sort()).toEqual(MIRA_TEMPLATE_IDS)
  })

  it('renders oversell risk in English deterministically', () => {
    const input = {
      sku: 'NRD-CHAIR-012',
      total_24h: 11,
      on_hand: 9,
      channel_breakdown: { amazon_it: 8, google_de: 3 },
    }

    const first = renderTemplate('oversell_risk_v1', input)
    const second = renderTemplate('oversell_risk_v1', input)

    expect(first).toBe(
      'NRD-CHAIR-012 sold 11 units in the last 24h (8 on amazon_it, 3 on google_de) against 9 on hand. Next order will oversell.'
    )
    expect(second).toBe(first)
  })

  it('renders restock proposal in English deterministically', () => {
    const input = {
      sku: 'NRD-SHELF-008',
      sell_through_per_week: 6,
      supplier_lead_time_weeks: 14,
      safety_buffer_weeks: 3,
      reorder_qty: 54,
    }

    expect(renderTemplate('restock_proposal_v1', input)).toBe(
      'NRD-SHELF-008: sell-through 6/week, supplier lead time 14 weeks, safety buffer 3 weeks. Proposing reorder of 54 units.'
    )
  })

  it('renders supplier losses in English deterministically', () => {
    const input = {
      supplier: 'Bois & Design',
      quantity: 5,
      sku: 'NRD-CHAIR-012',
      loss_type: 'delivery_short',
      cost: 212.5,
      count: 2,
      rate: 4.35,
    }

    expect(renderTemplate('supplier_loss_v1', input)).toBe(
      'Supplier loss declared: Bois & Design short-delivered 5 units of NRD-CHAIR-012 (loss_type: delivery_short). Estimated cost: €212.50. This is the 2nd loss from this supplier in the last 90 days. Current defect rate: 4.35%.'
    )
  })

  it('throws on unknown template ids', () => {
    expect(() =>
      renderTemplate('unknown_template_v1', { sku: 'NRD-001' })
    ).toThrow(/Unknown template_id/)
  })
})
