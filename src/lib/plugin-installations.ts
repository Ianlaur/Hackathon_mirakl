import { prisma } from '@/lib/prisma'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import { sanitizeActivePluginsForRegistry } from '@/lib/plugins'

export type PluginInstallationRow = {
  plugin_id: string
  enabled: boolean
}

export function buildPluginInstallationSnapshot(rows: PluginInstallationRow[]) {
  return {
    activePlugins: sanitizeActivePluginsForRegistry(
      rows.filter((row) => row.enabled).map((row) => row.plugin_id)
    ),
    initialized: rows.length > 0,
  }
}

export async function listPluginInstallationSnapshot(userId: string) {
  const rows = await prisma.pluginInstallation.findMany({
    where: { user_id: userId },
    select: {
      plugin_id: true,
      enabled: true,
    },
    orderBy: { plugin_id: 'asc' },
  })

  return buildPluginInstallationSnapshot(rows)
}

export async function setPluginInstallations(userId: string, plugins: string[]) {
  const activePlugins = sanitizeActivePluginsForRegistry(plugins)
  const activeSet = new Set(activePlugins)

  await prisma.$transaction(
    NAVIGATION_CONFIG.plugins.map((plugin) =>
      prisma.pluginInstallation.upsert({
        where: {
          user_id_plugin_id: {
            user_id: userId,
            plugin_id: plugin.id,
          },
        },
        update: {
          enabled: activeSet.has(plugin.id),
        },
        create: {
          user_id: userId,
          plugin_id: plugin.id,
          enabled: activeSet.has(plugin.id),
        },
      })
    )
  )

  return listPluginInstallationSnapshot(userId)
}
