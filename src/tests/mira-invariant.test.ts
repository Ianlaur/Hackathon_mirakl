import { describe, expect, it } from 'vitest'

import { listDecisionTemplates, listDistinctLedgerTemplateIds } from '@/lib/mira/ledger'
import { MIRA_TEMPLATE_IDS, renderTemplate } from '@/lib/mira/templates'

describe('mira template invariant', () => {
  it('matches the database allowlist in decision_templates', async () => {
    const rows = await listDecisionTemplates()

    expect(rows.map((row) => row.id)).toEqual(MIRA_TEMPLATE_IDS)
  })

  it('covers every template id already present in decision_ledger', async () => {
    const rows = await listDistinctLedgerTemplateIds()

    for (const templateId of rows) {
      expect(MIRA_TEMPLATE_IDS).toContain(templateId)
    }
  })

  it('rejects unknown template ids', () => {
    expect(() => renderTemplate('made_up_template_v1', {})).toThrow(/Unknown template_id/)
  })

  it('is deterministic for the same input', () => {
    const input = {
      sku: 'NRD-LAMP-022',
      previous_buffer_units: 15,
      next_buffer_units: 18,
      reason: 'Black Friday in 21 days, category historical uplift +34%',
    }

    expect(renderTemplate('buffer_adjustment_v1', input)).toBe(
      renderTemplate('buffer_adjustment_v1', input)
    )
  })
})
