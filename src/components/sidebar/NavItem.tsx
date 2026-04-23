'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  AlertTriangle,
  Bot,
  Boxes,
  Calendar,
  ChevronDown,
  GitBranch,
  Grid,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Store,
  TrendingDown,
  Truck,
  Warehouse,
} from 'lucide-react'
import NavSubItem from '@/components/sidebar/NavSubItem'
import type { NavItem as NavItemType } from '@/types/navigation'

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Store,
  Calendar,
  Bot,
  ShoppingCart,
  Package,
  AlertTriangle,
  Grid,
  Settings,
  Inbox,
  GitBranch,
  Boxes,
  Truck,
  Warehouse,
  TrendingDown,
}

function resolveIcon(iconName?: string) {
  if (!iconName) return LayoutDashboard
  return ICONS[iconName] ?? LayoutDashboard
}

type NavItemProps = {
  item: NavItemType
  active: boolean
  open?: boolean
  isSubitemActive: (href: string) => boolean
  onToggleGroup?: (itemId: string) => void
}

export default function NavItem({ item, active, open = false, isSubitemActive, onToggleGroup }: NavItemProps) {
  if (item.type === 'profile') return null

  const Icon = resolveIcon(item.icon)
  const isExpandable = Boolean(item.expandable && item.subitems?.length)

  if (!isExpandable) {
    if (!item.href) return null

    return (
      <Link
        href={item.href}
        className={`mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2 font-serif text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-slate-50 text-[#2764ff] border border-slate-200'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#2764ff]' : 'text-slate-400'}`} />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup?.(item.id)}
        className={`mx-2 my-0.5 flex w-[calc(100%-16px)] items-center gap-3 rounded-md px-3 py-2 text-left font-serif text-sm font-medium transition-all duration-200 ${
          active
            ? 'text-[#2764ff]'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#2764ff]' : 'text-slate-400'}`} />
        <span>{item.label}</span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="ml-8 mr-2 border-l border-slate-100 pl-3">
          {item.subitems?.map((subitem) => (
            <NavSubItem key={subitem.id} item={subitem} active={isSubitemActive(subitem.href)} />
          ))}
        </div>
      )}
    </div>
  )
}
