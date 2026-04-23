'use client'

import NavItem from '@/components/sidebar/NavItem'
import type { NavItem as NavItemType } from '@/types/navigation'

type PluginNavItemsProps = {
  items: NavItemType[]
  isItemActive: (item: NavItemType) => boolean
  isSubitemActive: (href: string) => boolean
  isItemOpen: (item: NavItemType) => boolean
  onToggleGroup: (itemId: string) => void
  collapsed?: boolean
}

export default function PluginNavItems({
  items,
  isItemActive,
  isSubitemActive,
  isItemOpen,
  onToggleGroup,
  collapsed = false,
}: PluginNavItemsProps) {
  return (
    <>
      {items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          active={isItemActive(item)}
          open={isItemOpen(item)}
          collapsed={collapsed}
          isSubitemActive={isSubitemActive}
          onToggleGroup={onToggleGroup}
        />
      ))}
    </>
  )
}
