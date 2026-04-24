import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AUTONOMY_ACTION_TYPES,
  buildAutonomySnapshot,
  buildPauseEverythingConfig,
} from '@/lib/mira/autonomy-config'

describe('autonomy config helpers', () => {
  it('merges stored rows onto the default action type list', () => {
    expect(
      buildAutonomySnapshot([
        { action_type: 'pause_listing', mode: 'handle_it' },
        { action_type: 'restock', mode: 'watching' },
      ]).items
    ).toEqual(
      expect.arrayContaining([
        { action_type: 'pause_listing', mode: 'auto_execute', label: 'Handle it' },
        { action_type: 'restock', mode: 'observe', label: 'Watching' },
      ])
    )
  })

  it('builds pause-everything rows for every action type', () => {
    const rows = buildPauseEverythingConfig()

    expect(rows).toHaveLength(DEFAULT_AUTONOMY_ACTION_TYPES.length)
    expect(rows.every((row) => row.mode === 'observe')).toBe(true)
  })
})
