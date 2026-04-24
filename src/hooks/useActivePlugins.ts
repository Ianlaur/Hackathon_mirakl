'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import {
  ACTIVE_PLUGINS_CHANGED_EVENT,
  ACTIVE_PLUGINS_STORAGE_KEY,
  emitActivePluginsChanged,
  hasStoredActivePlugins,
  isLegacyProEnabled,
  LEGACY_PRO_PLUGIN_STORAGE_KEY,
  persistActivePlugins,
  readStoredActivePlugins,
  sanitizeActivePluginsForRegistry,
  togglePluginId,
} from '@/lib/plugins'

const DEFAULT_PRO_PLUGIN_IDS = NAVIGATION_CONFIG.plugins.map((plugin) => plugin.id)

function readInitialPlugins(): string[] {
  if (typeof window === 'undefined') return []

  const storedPlugins = readStoredActivePlugins()
  if (storedPlugins.length > 0 || hasStoredActivePlugins()) {
    return storedPlugins
  }

  if (isLegacyProEnabled()) {
    persistActivePlugins(DEFAULT_PRO_PLUGIN_IDS)
    return DEFAULT_PRO_PLUGIN_IDS
  }

  return []
}

async function persistPluginsToDatabase(plugins: string[]) {
  const response = await fetch('/api/plugins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plugins }),
  })

  if (!response.ok) return null

  const payload = await response.json().catch(() => null)
  return Array.isArray(payload?.activePlugins)
    ? sanitizeActivePluginsForRegistry(payload.activePlugins)
    : null
}

export function useActivePlugins() {
  const [activePlugins, setActivePlugins] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  const syncFromStorage = useCallback(() => {
    setActivePlugins(readStoredActivePlugins())
  }, [])

  useEffect(() => {
    // Keep first client render identical to server render to avoid hydration mismatch.
    const initialPlugins = readInitialPlugins()
    let cancelled = false

    setActivePlugins(initialPlugins)
    setHydrated(true)

    async function syncFromDatabase() {
      try {
        const response = await fetch('/api/plugins', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json().catch(() => null)
        if (!payload || cancelled) return

        if (payload.initialized === false && initialPlugins.length > 0) {
          const migrated = await persistPluginsToDatabase(initialPlugins)
          if (migrated && !cancelled) {
            persistActivePlugins(migrated)
            setActivePlugins(migrated)
            emitActivePluginsChanged(migrated)
          }
          return
        }

        const next = sanitizeActivePluginsForRegistry(payload.activePlugins)
        persistActivePlugins(next)
        setActivePlugins(next)
        emitActivePluginsChanged(next)
      } catch {
        // Local cache remains usable if the demo DB is unavailable.
      }
    }

    void syncFromDatabase()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ACTIVE_PLUGINS_STORAGE_KEY) return
      syncFromStorage()
    }

    const onCustomUpdate = () => {
      syncFromStorage()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(ACTIVE_PLUGINS_CHANGED_EVENT, onCustomUpdate)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(ACTIVE_PLUGINS_CHANGED_EVENT, onCustomUpdate)
    }
  }, [hydrated, syncFromStorage])

  const setPlugins = useCallback((plugins: string[]) => {
    const next = sanitizeActivePluginsForRegistry(plugins)
    persistActivePlugins(next)
    window.localStorage.setItem(LEGACY_PRO_PLUGIN_STORAGE_KEY, String(next.length > 0))
    setActivePlugins(next)
    emitActivePluginsChanged(next)
    void persistPluginsToDatabase(next).then((saved) => {
      if (!saved) return
      persistActivePlugins(saved)
      window.localStorage.setItem(LEGACY_PRO_PLUGIN_STORAGE_KEY, String(saved.length > 0))
      setActivePlugins(saved)
      emitActivePluginsChanged(saved)
    })
  }, [])

  const togglePlugin = useCallback((pluginId: string) => {
    setActivePlugins((previous) => {
      const next = togglePluginId(previous, pluginId)
      persistActivePlugins(next)
      window.localStorage.setItem(LEGACY_PRO_PLUGIN_STORAGE_KEY, String(next.length > 0))
      emitActivePluginsChanged(next)
      return next
    })
  }, [])

  const isActive = useCallback(
    (pluginId: string) => {
      return activePlugins.includes(pluginId)
    },
    [activePlugins]
  )

  return useMemo(
    () => ({
      activePlugins,
      togglePlugin,
      isActive,
      setPlugins,
    }),
    [activePlugins, isActive, setPlugins, togglePlugin]
  )
}
