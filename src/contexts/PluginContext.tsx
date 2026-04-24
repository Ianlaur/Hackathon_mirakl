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
import { useActivePlugins } from '@/hooks/useActivePlugins'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import { LEGACY_PRO_PLUGIN_STORAGE_KEY } from '@/lib/plugins'

const USER_PROFILE_STORAGE_KEY = 'mirakl_user_profile'
const PRO_MODE_PLUGIN_IDS = NAVIGATION_CONFIG.plugins.map((plugin) => plugin.id)

export type UserProfile = 'LOCAL' | 'INTERNATIONAL' | null

type PluginContextValue = {
  activePlugins: string[]
  isProPluginActive: boolean
  userProfile: UserProfile
  isPluginActive: (pluginId: string) => boolean
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
  const { activePlugins, isActive, setPlugins } = useActivePlugins()
  const [userProfile, setUserProfileState] = useState<UserProfile>(null)
  const [hydrated, setHydrated] = useState(false)
  const isProPluginActive = activePlugins.length > 0

  useEffect(() => {
    const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)
    setUserProfileState(parseStoredProfile(storedProfile))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(LEGACY_PRO_PLUGIN_STORAGE_KEY, String(isProPluginActive))
  }, [hydrated, isProPluginActive])

  useEffect(() => {
    if (!hydrated) return

    if (userProfile) {
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, userProfile)
      return
    }

    window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY)
  }, [hydrated, userProfile])

  const toggleProPlugin = useCallback(() => {
    setPlugins(isProPluginActive ? [] : PRO_MODE_PLUGIN_IDS)
  }, [isProPluginActive, setPlugins])

  const activateProPlugin = useCallback(() => {
    setPlugins(PRO_MODE_PLUGIN_IDS)
  }, [setPlugins])

  const deactivateProPlugin = useCallback(() => {
    setPlugins([])
  }, [setPlugins])

  const setUserProfile = useCallback((profile: UserProfile) => {
    setUserProfileState(profile)
  }, [])

  const value = useMemo<PluginContextValue>(
    () => ({
      activePlugins,
      isProPluginActive,
      userProfile,
      isPluginActive: isActive,
      toggleProPlugin,
      activateProPlugin,
      deactivateProPlugin,
      setUserProfile,
    }),
    [
      activePlugins,
      activateProPlugin,
      deactivateProPlugin,
      isActive,
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
