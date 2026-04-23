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
        className={`mx-2 my-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
          active
            ? 'bg-blue-50 font-bold text-blue-700'
            : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? 'text-blue-700' : 'text-slate-500'}`} />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup?.(item.id)}
        className={`mx-2 my-0.5 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
          active
            ? 'bg-blue-50 font-bold text-blue-700'
            : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? 'text-blue-700' : 'text-slate-500'}`} />
        <span>{item.label}</span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="mb-1 ml-5 mr-2 border-l-2 border-blue-200 pl-4">
          {item.subitems?.map((subitem) => (
            <NavSubItem key={subitem.id} item={subitem} active={isSubitemActive(subitem.href)} />
          ))}
        </div>
      )}
    </div>
  )
}
