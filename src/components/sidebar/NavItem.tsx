'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  AlertTriangle,
  Bot,
  Boxes,
  Calendar,
  ChevronDown,
  FileSpreadsheet,
  GitBranch,
  Grid,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingDown,
  Truck,
  Warehouse,
} from 'lucide-react'
import NavSubItem from '@/components/sidebar/NavSubItem'
import type { NavItem as NavItemType } from '@/types/navigation'

function LeiaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="1 6 22 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="5" />
      <ellipse cx="5.5" cy="11" rx="2.5" ry="2" />
      <ellipse cx="18.5" cy="11" rx="2.5" ry="2" />
    </svg>
  )
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Store,
  Calendar,
  FileSpreadsheet,
  Bot: LeiaIcon,
  ShoppingCart,
  Package,
  AlertTriangle,
  Grid,
  Settings,
  ShieldCheck,
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
  collapsed?: boolean
  isSubitemActive: (href: string) => boolean
  onToggleGroup?: (itemId: string) => void
}

export default function NavItem({ item, active, open = false, collapsed = false, isSubitemActive, onToggleGroup }: NavItemProps) {
  if (item.type === 'profile') return null

  const Icon = resolveIcon(item.icon)
  const isExpandable = Boolean(item.expandable && item.subitems?.length)

  if (!isExpandable) {
    if (!item.href) return null

    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`mx-2 my-0.5 flex items-center rounded-md py-2.5 font-serif text-sm font-medium transition-all duration-200 ${
          collapsed ? 'justify-center px-0' : 'gap-3 px-3'
        } ${
          active
            ? `bg-[#2764FF]/5 text-[#2764FF] font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${collapsed ? '' : 'border-l-[3px] border-[#2764FF]'}`
            : 'text-[#6B7480] hover:bg-[#F2F8FF] hover:text-[#03182F]'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-[#2764FF]' : 'text-[#6B7480]'}`} />
        <span className={`transition-all duration-300 ${collapsed ? 'hidden' : ''}`}>{item.label}</span>
      </Link>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup?.(item.id)}
        title={collapsed ? item.label : undefined}
        className={`mx-2 my-0.5 flex items-center rounded-md py-2.5 text-left font-serif text-sm font-medium transition-all duration-200 ${
          collapsed ? 'w-[calc(100%-16px)] justify-center px-0' : 'w-[calc(100%-16px)] gap-3 px-3'
        } ${
          active
            ? 'text-[#2764FF] font-bold'
            : 'text-[#6B7480] hover:bg-[#F2F8FF] hover:text-[#03182F]'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-[#2764FF]' : 'text-[#6B7480]'}`} />
        <span className={`transition-all duration-300 ${collapsed ? 'hidden' : ''}`}>{item.label}</span>
        {!collapsed && (
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 text-[#6B7480] transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {open && !collapsed && (
        <div className="ml-8 mr-2 border-l border-[#DDE5EE] pl-3">
          {item.subitems?.map((subitem) => (
            <NavSubItem key={subitem.id} item={subitem} active={isSubitemActive(subitem.href)} />
          ))}
        </div>
      )}
    </div>
  )
}
