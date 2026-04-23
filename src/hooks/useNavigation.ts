'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { NAVIGATION_CONFIG } from '@/lib/navigation'
import { useActivePlugins } from '@/hooks/useActivePlugins'
import type { NavItem } from '@/types/navigation'

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  const hrefActive = item.href ? isPathActive(pathname, item.href) : false
  if (hrefActive) return true
  if (!item.subitems?.length) return false
  return item.subitems.some((subitem) => isPathActive(pathname, subitem.href))
}

export function useNavigation() {
  const pathname = usePathname()
  const { activePlugins } = useActivePlugins()

  const pluginItems = useMemo(() => {
    return NAVIGATION_CONFIG.plugins
      .filter((plugin) => activePlugins.includes(plugin.id))
      .sort((a, b) => a.position - b.position)
      .flatMap((plugin) => plugin.items)
  }, [activePlugins])

  const basicItems = NAVIGATION_CONFIG.basicItems
  const bottomItems = NAVIGATION_CONFIG.bottomItems
  const allItems = useMemo(() => [...basicItems, ...pluginItems], [basicItems, pluginItems])

  const isActive = useMemo(() => {
    return (href: string) => isPathActive(pathname, href)
  }, [pathname])

  const isItemActive = useMemo(() => {
    return (item: NavItem) => isNavItemActive(pathname, item)
  }, [pathname])

  return {
    basicItems,
    pluginItems,
    allItems,
    bottomItems,
    isActive,
    isItemActive,
    pathname,
  }
}
