'use client'

import { useEffect, useMemo, useState } from 'react'
import { Menu, LogOut, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import NavItem from '@/components/sidebar/NavItem'
import PluginNavItems from '@/components/sidebar/PluginNavItems'
import SidebarHeader from '@/components/sidebar/SidebarHeader'
import SidebarProfile from '@/components/sidebar/SidebarProfile'
import { useNavigation } from '@/hooks/useNavigation'
import { usePluginContext } from '@/contexts/PluginContext'
import type { NavItem as NavItemType } from '@/types/navigation'

type SidebarProps = {
  onExpandedChange?: (expanded: boolean) => void
}

export default function Sidebar({ onExpandedChange }: SidebarProps) {
  const router = useRouter()
  const { basicItems, pluginItems, bottomItems, isActive, isItemActive, pathname } = useNavigation()
  const { deactivateProPlugin, setUserProfile, userProfile } = usePluginContext()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [manualOpenGroupId, setManualOpenGroupId] = useState<string | null>(null)

  useEffect(() => {
    onExpandedChange?.(true)
  }, [onExpandedChange])

  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  const activeGroupId = useMemo(() => {
    const groupedItems = [...basicItems, ...pluginItems]
    const activeGroup = groupedItems.find((item) => {
      if (!(item.expandable && item.subitems?.length)) return false
      return isItemActive(item)
    })
    return activeGroup?.id ?? null
  }, [basicItems, isItemActive, pluginItems])

  const isSubitemActive = (href: string) => isActive(href)

  const isItemOpen = (item: NavItemType) => {
    if (!(item.expandable && item.subitems?.length)) return false
    return item.id === activeGroupId || item.id === manualOpenGroupId
  }

  const handleToggleGroup = (itemId: string) => {
    setManualOpenGroupId((current) => {
      if (current === itemId) {
        return activeGroupId === itemId ? current : null
      }
      return itemId
    })
  }

  const profileLabel =
    bottomItems.find((item) => item.type === 'profile')?.label ?? 'Jean-Charles'

  const profileSubtitle =
    bottomItems.find((item) => item.type === 'profile')?.subtitle ??
    (userProfile === 'INTERNATIONAL' ? 'Marchand international' : 'Marchand local')

  const bottomLinkItems = bottomItems.filter((item) => item.type !== 'profile')

  const handleSignOut = () => {
    deactivateProPlugin()
    setUserProfile(null)
    setIsMobileOpen(false)
    router.push('/onboarding')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Ouvrir la navigation"
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileOpen && (
        <button
          type="button"
          aria-label="Fermer la navigation"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col border-r border-slate-200 bg-white font-sans transition-transform duration-200 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="lg:hidden">
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600"
              aria-label="Fermer le menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <SidebarHeader />
        <hr className="mx-4 h-px border-0 bg-slate-100" />

        <div className="flex-1 overflow-y-auto py-3">
          <nav>
            {basicItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={isItemActive(item)}
                open={isItemOpen(item)}
                isSubitemActive={isSubitemActive}
                onToggleGroup={handleToggleGroup}
              />
            ))}

            <PluginNavItems
              items={pluginItems}
              isItemActive={isItemActive}
              isSubitemActive={isSubitemActive}
              isItemOpen={isItemOpen}
              onToggleGroup={handleToggleGroup}
            />
          </nav>

          <hr className="mx-4 my-3 h-px border-0 bg-slate-100" />

          <nav>
            {bottomLinkItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={isItemActive(item)}
                isSubitemActive={isSubitemActive}
              />
            ))}
          </nav>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

        <SidebarProfile name={profileLabel} role={profileSubtitle} />
      </aside>
    </>
  )
}
