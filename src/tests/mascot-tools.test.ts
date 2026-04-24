import { describe, expect, it } from 'vitest'

import { MASCOT_TOOLS, validateToolArgs } from '@/lib/mascot-tools'

const toolNames = () => MASCOT_TOOLS.map((tool) => tool.function.name).sort()

describe('Leia tool surface', () => {
  it('exposes the ten required read tools', () => {
    expect(toolNames()).toEqual(
      expect.arrayContaining([
        'compare_channels',
        'get_seasonal_patterns',
        'get_top_products',
        'predict_stockout',
        'query_calendar',
        'query_decisions',
        'query_orders',
        'query_returns',
        'query_stock',
        'query_velocity',
      ])
    )
  })

  it('exposes the six required governed action tools', () => {
    expect(toolNames()).toEqual(
      expect.arrayContaining([
        'approve_decision',
        'declare_supplier_loss',
        'execute_action',
        'override_decision',
        'reject_decision',
        'set_founder_state',
        'update_autonomy',
      ])
    )
  })

  it('schema-validates required tool arguments before execution', () => {
    expect(() => validateToolArgs('query_velocity', {})).toThrow(/sku/)
    expect(validateToolArgs('query_velocity', { sku: 'NRD-CHAIR-012', window_hours: 48 })).toEqual({
      sku: 'NRD-CHAIR-012',
      window_hours: 48,
    })
  })

  it('schema-validates seasonal read tool arguments', () => {
    expect(
      validateToolArgs('get_seasonal_patterns', {
        event: 'Ferragosto',
        category: 'lamps',
      })
    ).toEqual({
      event: 'Ferragosto',
      category: 'lamps',
    })

    expect(
      validateToolArgs('predict_stockout', {
        sku: 'NKS-00012',
        seasonal_context: {
          event_name: 'Ferragosto',
          growth_factor: 1.34,
        },
      })
    ).toEqual({
      sku: 'NKS-00012',
      seasonal_context: {
        event_name: 'Ferragosto',
        growth_factor: 1.34,
      },
    })
  })

  it('schema-validates supplier loss declarations', () => {
    expect(() =>
      validateToolArgs('declare_supplier_loss', {
        supplier_name: 'Bois & Design',
        sku: 'NRD-CHAIR-012',
        loss_type: 'supplier_delay',
        quantity: 5,
      })
    ).toThrow(/loss_type/)

    expect(
      validateToolArgs('declare_supplier_loss', {
        supplier_name: 'Bois & Design',
        sku: 'NRD-CHAIR-012',
        loss_type: 'delivery_short',
        quantity: 5,
        notes: 'Delivered 45 chairs instead of 50',
      })
    ).toEqual({
      supplier_name: 'Bois & Design',
      sku: 'NRD-CHAIR-012',
      loss_type: 'delivery_short',
      quantity: 5,
      notes: 'Delivered 45 chairs instead of 50',
    })
  })

  it('does not expose internal template ids in query_decisions results by default', () => {
    const decisionTool = MASCOT_TOOLS.find((tool) => tool.function.name === 'query_decisions')
    expect(JSON.stringify(decisionTool)).not.toContain('template_id')
    expect(JSON.stringify(decisionTool)).not.toContain('decision_ledger')
  })
})
