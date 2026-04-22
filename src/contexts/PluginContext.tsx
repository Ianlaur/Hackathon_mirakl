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

const PRO_PLUGIN_STORAGE_KEY = 'mirakl_global_control_tower_active'
const USER_PROFILE_STORAGE_KEY = 'mirakl_user_profile'

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

  useEffect(() => {
    const storedPluginValue = window.localStorage.getItem(PRO_PLUGIN_STORAGE_KEY)
    const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)

    if (storedPluginValue !== null) {
      setIsProPluginActive(storedPluginValue === 'true')
    }
    setUserProfileState(parseStoredProfile(storedProfile))
    setHydrated(true)
  }, [])

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

  const toggleProPlugin = useCallback(() => {
    setIsProPluginActive((current) => !current)
  }, [])

  const activateProPlugin = useCallback(() => {
    setIsProPluginActive(true)
  }, [])

  const deactivateProPlugin = useCallback(() => {
    setIsProPluginActive(false)
  }, [])

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
