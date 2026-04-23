'use client'

import { useEffect, useMemo, useState } from 'react'
import { Menu, LogOut, X, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [manualOpenGroupId, setManualOpenGroupId] = useState<string | null>(null)

  const expanded = pinned || hovered || isMobileOpen
  const collapsed = !expanded

  useEffect(() => {
    onExpandedChange?.(expanded)
  }, [expanded, onExpandedChange])

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
    if (collapsed) return false
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
        className="fixed left-4 top-4 z-50 rounded-lg border border-[#DDE5EE] bg-white p-2 text-[#30373E] shadow-sm lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileOpen && (
        <button
          type="button"
          aria-label="Fermer la navigation"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-[#03182F]/40 lg:hidden"
        />
      )}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[#DDE5EE] bg-white transition-all duration-300 ease-out ${
          expanded ? 'w-60' : 'w-[68px]'
        } ${isMobileOpen ? 'translate-x-0 !w-60' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="lg:hidden">
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="rounded-lg border border-[#DDE5EE] bg-white p-1.5 text-[#6B7480]"
              aria-label="Fermer le menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Header with collapse toggle */}
        <div className="flex items-center justify-between px-4 pb-4 pt-6">
          <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <div className="text-lg font-bold text-[#03182F] tracking-widest font-serif whitespace-nowrap">MIRAKL CONNECT</div>
            <div className="text-xs text-[#6B7480] uppercase mt-1 tracking-wider">Operations</div>
          </div>
        </div>
        <hr className="mx-3 h-px border-0 bg-[#DDE5EE]" />

        <div className="flex-1 overflow-y-auto py-3">
          <nav>
            {basicItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={isItemActive(item)}
                open={isItemOpen(item)}
                collapsed={collapsed}
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
              collapsed={collapsed}
            />
          </nav>

          <hr className="mx-3 my-3 h-px border-0 bg-[#DDE5EE]" />

          <nav>
            {bottomLinkItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={isItemActive(item)}
                collapsed={collapsed}
                isSubitemActive={isSubitemActive}
              />
            ))}
          </nav>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={handleSignOut}
            className={`flex w-full items-center rounded-lg border border-[#DDE5EE] bg-white px-3 py-2 text-sm font-medium text-[#30373E] transition-colors hover:bg-[#F2F8FF] hover:text-[#03182F] ${collapsed ? 'justify-center' : 'gap-2'}`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className={`transition-all duration-300 ${collapsed ? 'hidden' : ''}`}>Sign out</span>
          </button>
        </div>

        {/* Profile - hide text when collapsed */}
        <div className="border-t border-[#DDE5EE] bg-[#F2F8FF] p-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-semibold text-white">
              {profileLabel.split(' ').filter(Boolean).slice(0, 2).map((c) => c[0]?.toUpperCase() ?? '').join('')}
            </div>
            <div className={`min-w-0 transition-all duration-300 ${collapsed ? 'hidden' : ''}`}>
              <p className="truncate text-sm font-semibold text-[#03182F]">{profileLabel}</p>
              <p className="truncate text-xs text-[#6B7480]">{profileSubtitle}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
