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

  it('does not expose internal template ids in query_decisions results by default', () => {
    const decisionTool = MASCOT_TOOLS.find((tool) => tool.function.name === 'query_decisions')
    expect(JSON.stringify(decisionTool)).not.toContain('template_id')
    expect(JSON.stringify(decisionTool)).not.toContain('decision_ledger')
  })
})
