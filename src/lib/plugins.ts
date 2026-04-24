import { NAVIGATION_CONFIG } from '@/lib/navigation'

export const ACTIVE_PLUGINS_STORAGE_KEY = 'mirakl_active_plugins'
export const LEGACY_PRO_PLUGIN_STORAGE_KEY = 'mirakl_global_control_tower_active'
export const ACTIVE_PLUGINS_CHANGED_EVENT = 'mirakl:active_plugins_changed'

const KNOWN_PLUGIN_IDS = NAVIGATION_CONFIG.plugins.map((plugin) => plugin.id)

function sanitizePluginList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()

  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      unique.add(entry)
    }
  }

  return Array.from(unique)
}

export function sanitizeActivePluginsForRegistry(value: unknown): string[] {
  const known = new Set(KNOWN_PLUGIN_IDS)
  return sanitizePluginList(value).filter((pluginId) => known.has(pluginId))
}

export function readStoredActivePlugins(): string[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(ACTIVE_PLUGINS_STORAGE_KEY)
  if (!raw) return []

  try {
    return sanitizeActivePluginsForRegistry(JSON.parse(raw))
  } catch {
    return []
  }
}

export function hasStoredActivePlugins(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ACTIVE_PLUGINS_STORAGE_KEY) !== null
}

export function persistActivePlugins(plugins: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    ACTIVE_PLUGINS_STORAGE_KEY,
    JSON.stringify(sanitizeActivePluginsForRegistry(plugins))
  )
}

export function isLegacyProEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(LEGACY_PRO_PLUGIN_STORAGE_KEY) === 'true'
}

export function togglePluginId(list: string[], pluginId: string): string[] {
  return sanitizeActivePluginsForRegistry(
    list.includes(pluginId) ? list.filter((id) => id !== pluginId) : [...list, pluginId]
  )
}

export function emitActivePluginsChanged(plugins: string[]) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(ACTIVE_PLUGINS_CHANGED_EVENT, {
      detail: { plugins: sanitizeActivePluginsForRegistry(plugins) },
    })
  )
}
