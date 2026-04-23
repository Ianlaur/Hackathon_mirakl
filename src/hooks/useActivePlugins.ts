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

export function useActivePlugins() {
  const [activePlugins, setActivePlugins] = useState<string[]>(readInitialPlugins)

  const syncFromStorage = useCallback(() => {
    setActivePlugins(readStoredActivePlugins())
  }, [])

  useEffect(() => {
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
  }, [syncFromStorage])

  const setPlugins = useCallback((plugins: string[]) => {
    const next = Array.from(new Set(plugins))
    persistActivePlugins(next)
    window.localStorage.setItem(LEGACY_PRO_PLUGIN_STORAGE_KEY, String(next.length > 0))
    setActivePlugins(next)
    emitActivePluginsChanged(next)
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
