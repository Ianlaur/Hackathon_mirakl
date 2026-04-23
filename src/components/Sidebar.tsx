'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent } from 'react'
import {
  Activity,
  Boxes,
  LayoutDashboard,
  Bot,
  Inbox,
  Package,
  Warehouse,
  Radar,
  Truck,
  TrendingDown,
  CalendarDays,
  Calendar,
  Store,
  Settings,
  Menu,
  ChevronDown,
  Workflow,
} from 'lucide-react'

type NavLink = {
  type: 'link'
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
}

type NavGroup = {
  type: 'group'
  id: string
  name: string
  icon: ComponentType<{ className?: string }>
  items: Array<{
    name: string
    href: string
    icon: ComponentType<{ className?: string }>
  }>
}

type NavEntry = NavLink | NavGroup

type SidebarProps = {
  /** Called whenever the sidebar expands or collapses so the parent can adjust layout margins */
  onExpandedChange?: (expanded: boolean) => void
}

const navigation: NavEntry[] = [
  { type: 'link', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { type: 'link', name: 'Actions', href: '/actions', icon: Inbox },
  { type: 'link', name: 'Activity', href: '/activity', icon: Activity },
  { type: 'link', name: 'RADAR', href: '/radar', icon: Radar },
  {
    type: 'group',
    id: 'operations',
    name: 'Opérations',
    icon: Workflow,
    items: [
      { name: 'Planning', href: '/planning', icon: CalendarDays },
      { name: 'Calendrier', href: '/calendar', icon: Calendar },
      { name: 'Transport', href: '/parcels', icon: Truck },
    ],
  },
  {
    type: 'group',
    id: 'inventory',
    name: 'Inventaire',
    icon: Boxes,
    items: [
      { name: 'Stock', href: '/stock', icon: Package },
      { name: 'Entrepôt', href: '/wms', icon: Warehouse },
      { name: 'Pertes', href: '/losses', icon: TrendingDown },
    ],
  },
  { type: 'link', name: 'App Store', href: '/app-store', icon: Store },
  { type: 'link', name: 'Paramètres', href: '/settings', icon: Settings },
]

function isPathActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Sidebar({ onExpandedChange }: SidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const navigationTimeoutRef = useRef<number | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    operations: true,
    inventory: true,
  })

  // Notify parent whenever expanded state changes
  useEffect(() => {
    onExpandedChange?.(isExpanded)
  }, [isExpanded, onExpandedChange])

  const activeGroups = useMemo(() => {
    return navigation
      .filter((entry): entry is NavGroup => entry.type === 'group')
      .reduce<Record<string, boolean>>((acc, group) => {
        acc[group.id] = group.items.some((item) => isPathActive(pathname, item.href))
        return acc
      }, {})
  }, [pathname])

  // Close mobile menu and clear navigating state on route change
  useEffect(() => {
    setIsMobileOpen(false)
    setIsNavigating(false)
    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current)
      navigationTimeoutRef.current = null
    }
  }, [pathname])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        window.clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // Auto-expand active group when route changes
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      for (const [groupId, isActive] of Object.entries(activeGroups)) {
        if (isActive) next[groupId] = true
      }
      return next
    })
  }, [activeGroups])

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isNavigating) {
      event.preventDefault()
      return
    }
    if (isPathActive(pathname, href)) {
      event.preventDefault()
      setIsMobileOpen(false)
      setIsNavigating(false)
      return
    }
    setIsMobileOpen(false)
    setIsNavigating(true)
    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current)
    }
    navigationTimeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false)
      navigationTimeoutRef.current = null
    }, 6000)
  }

  const handleMouseEnter = () => setIsExpanded(true)
  const handleMouseLeave = () => setIsExpanded(false)

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="fixed left-4 top-4 z-50 rounded-xl bg-slate-900 p-2.5 text-slate-300 shadow-xl border border-slate-800 lg:hidden hover:bg-slate-800 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <button
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-slate-950 text-white transition-all duration-300 ease-out border-r border-slate-800/60 shadow-2xl overflow-hidden
          ${isExpanded ? 'w-64' : 'w-20'}
          ${isMobileOpen ? 'translate-x-0 !w-64' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-full flex-col py-6 px-3 overflow-y-auto overflow-x-hidden scrollbar-hide">

          {/* Logo / Brand */}
          <div className="mb-10 flex items-center px-2 min-h-[40px]">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20">
              M
            </div>
            <div
              className={`ml-3 flex flex-col whitespace-nowrap transition-all duration-300 ${
                isExpanded || isMobileOpen ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Hackathon</span>
              <span className="text-lg font-bold tracking-tight">Mirakl Tower</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 space-y-1 ${isNavigating ? 'opacity-75' : ''}`}>
            {navigation.map((entry) => {
              if (entry.type === 'link') {
                const active = isPathActive(pathname, entry.href)

                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    prefetch={false}
                    onClick={(event) => handleNavigation(event, entry.href)}
                    title={!isExpanded && !isMobileOpen ? entry.name : undefined}
                    className={`group relative flex items-center rounded-xl px-3 py-3 font-medium transition-all duration-200 ${
                      active
                        ? 'bg-blue-600/10 text-blue-500'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <entry.icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        active ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span
                      className={`ml-4 whitespace-nowrap transition-all duration-300 ${
                        isExpanded || isMobileOpen ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                      }`}
                    >
                      {entry.name}
                    </span>

                    {active && (isExpanded || isMobileOpen) && (
                      <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </Link>
                )
              }

              // Group entry
              const groupIsActive = activeGroups[entry.id]
              const groupIsOpen = openGroups[entry.id]

              return (
                <div key={entry.id} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.id)}
                    title={!isExpanded && !isMobileOpen ? entry.name : undefined}
                    className={`group relative flex w-full items-center rounded-xl px-3 py-3 text-left font-medium transition-all duration-200 ${
                      groupIsActive
                        ? 'bg-blue-600/10 text-blue-500'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <entry.icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        groupIsActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span
                      className={`ml-4 whitespace-nowrap transition-all duration-300 ${
                        isExpanded || isMobileOpen ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                      }`}
                    >
                      {entry.name}
                    </span>

                    {(isExpanded || isMobileOpen) && (
                      <ChevronDown
                        className={`ml-auto h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                          groupIsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>

                  {/* Sub-items — only visible when expanded */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      (isExpanded || isMobileOpen) && groupIsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="ml-6 border-l border-slate-800/80 pl-3 space-y-0.5">
                      {entry.items.map((item) => {
                        const active = isPathActive(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
                            onClick={(event) => handleNavigation(event, item.href)}
                            className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                              active
                                ? 'bg-blue-600/10 font-medium text-blue-400'
                                : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200'
                            }`}
                          >
                            <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                            <span>{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="mt-8 border-t border-slate-800/60 pt-6">
            <div className="flex items-center px-2 min-h-[40px]">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-md">
                M
              </div>
              <div
                className={`ml-3 flex flex-col whitespace-nowrap transition-all duration-300 ${
                  isExpanded || isMobileOpen ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                }`}
              >
                <span className="text-sm font-semibold">Mirakl Tower</span>
                <span className="text-xs text-slate-400">Hackathon</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
