'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import {
  ACTIVE_PLUGINS_CHANGED_EVENT,
  ACTIVE_PLUGINS_STORAGE_KEY,
  LEGACY_PRO_PLUGIN_STORAGE_KEY,
  emitActivePluginsChanged,
  persistActivePlugins,
  readStoredActivePlugins,
} from '@/lib/plugins'

const PRO_PLUGIN_STORAGE_KEY = LEGACY_PRO_PLUGIN_STORAGE_KEY
const USER_PROFILE_STORAGE_KEY = 'mirakl_user_profile'
const PRO_MODE_PLUGIN_IDS = NAVIGATION_CONFIG.plugins.map((plugin) => plugin.id)

export type UserProfile = 'LOCAL' | 'INTERNATIONAL' | null

type PluginContextValue = {
  isProPluginActive: boolean
  userProfile: UserProfile
  toggleProPlugin: () => void
  activateProPlugin: () => void
  deactivateProPlugin: () => void
  setUserProfile: (profile: UserProfile) => void
}

const PluginContext = createContext<PluginContextValue | undefined>(undefined)

function parseStoredProfile(value: string | null): UserProfile {
  if (value === 'LOCAL' || value === 'INTERNATIONAL') return value
  return null
}

export function PluginProvider({ children }: { children: ReactNode }) {
  const [isProPluginActive, setIsProPluginActive] = useState(false)
  const [userProfile, setUserProfileState] = useState<UserProfile>(null)
  const [hydrated, setHydrated] = useState(false)

  const syncProStateFromStorage = useCallback(() => {
    const legacyEnabled = window.localStorage.getItem(PRO_PLUGIN_STORAGE_KEY) === 'true'
    const hasActivePluginItems = readStoredActivePlugins().length > 0
    setIsProPluginActive(legacyEnabled || hasActivePluginItems)
  }, [])

  useEffect(() => {
    const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)

    syncProStateFromStorage()
    setUserProfileState(parseStoredProfile(storedProfile))
    setHydrated(true)
  }, [syncProStateFromStorage])

  useEffect(() => {
    if (!hydrated) return

    const onStorageChange = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== PRO_PLUGIN_STORAGE_KEY &&
        event.key !== ACTIVE_PLUGINS_STORAGE_KEY
      ) {
        return
      }
      syncProStateFromStorage()
    }

    const onPluginEvent = () => {
      syncProStateFromStorage()
    }

    window.addEventListener('storage', onStorageChange)
    window.addEventListener(ACTIVE_PLUGINS_CHANGED_EVENT, onPluginEvent)

    return () => {
      window.removeEventListener('storage', onStorageChange)
      window.removeEventListener(ACTIVE_PLUGINS_CHANGED_EVENT, onPluginEvent)
    }
  }, [hydrated, syncProStateFromStorage])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(PRO_PLUGIN_STORAGE_KEY, String(isProPluginActive))
  }, [hydrated, isProPluginActive])

  useEffect(() => {
    if (!hydrated) return

    if (userProfile) {
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, userProfile)
      return
    }

    window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY)
  }, [hydrated, userProfile])

  const persistProMode = useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return

    const nextActivePlugins = enabled ? PRO_MODE_PLUGIN_IDS : []
    window.localStorage.setItem(PRO_PLUGIN_STORAGE_KEY, String(enabled))
    persistActivePlugins(nextActivePlugins)
    emitActivePluginsChanged(nextActivePlugins)
  }, [])

  const toggleProPlugin = useCallback(() => {
    setIsProPluginActive((current) => {
      const next = !current
      persistProMode(next)
      return next
    })
  }, [persistProMode])

  const activateProPlugin = useCallback(() => {
    setIsProPluginActive(true)
    persistProMode(true)
  }, [persistProMode])

  const deactivateProPlugin = useCallback(() => {
    setIsProPluginActive(false)
    persistProMode(false)
  }, [persistProMode])

  const setUserProfile = useCallback((profile: UserProfile) => {
    setUserProfileState(profile)
  }, [])

  const value = useMemo<PluginContextValue>(
    () => ({
      isProPluginActive,
      userProfile,
      toggleProPlugin,
      activateProPlugin,
      deactivateProPlugin,
      setUserProfile,
    }),
    [
      activateProPlugin,
      deactivateProPlugin,
      isProPluginActive,
      setUserProfile,
      toggleProPlugin,
      userProfile,
    ]
  )

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
}

export function usePluginContext() {
  const context = useContext(PluginContext)

  if (!context) {
    throw new Error('usePluginContext must be used inside PluginProvider')
  }

  return context
}
