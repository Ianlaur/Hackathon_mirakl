import { describe, expect, it } from 'vitest'

import { NAVIGATION_CONFIG } from '@/lib/navigation'
import { sanitizeActivePluginsForRegistry } from '@/lib/plugins'
import { buildPluginInstallationSnapshot } from '@/lib/plugin-installations'

describe('plugin registry', () => {
  it('does not register the removed Atlas duplicate plugin', () => {
    const atlasPlugins = NAVIGATION_CONFIG.plugins.filter((plugin) => plugin.id === 'plugin_atlas')

    expect(atlasPlugins).toHaveLength(0)
  })

  it('does not duplicate Losses Radar inside the operations plugin', () => {
    const pluginLinks = NAVIGATION_CONFIG.plugins.flatMap((plugin) =>
      plugin.items.map((item) => item.href)
    )

    expect(pluginLinks).not.toContain('/radar')
  })

  it('filters unknown plugin ids before persisting', () => {
    expect(
      sanitizeActivePluginsForRegistry([
        'plugin_operations',
        'plugin_does_not_exist',
        'plugin_operations',
      ])
    ).toEqual(['plugin_operations'])
  })

  it('builds an active plugin snapshot from database rows', () => {
    expect(
      buildPluginInstallationSnapshot([
        { plugin_id: 'plugin_operations', enabled: true },
        { plugin_id: 'plugin_does_not_exist', enabled: true },
        { plugin_id: 'plugin_actions', enabled: false },
      ])
    ).toEqual({
      activePlugins: ['plugin_operations'],
      initialized: true,
    })
  })
})
