'use client'

import Link from 'next/link'
import type { SubNavItem } from '@/types/navigation'

type NavSubItemProps = {
  item: SubNavItem
  active: boolean
}

export default function NavSubItem({ item, active }: NavSubItemProps) {
  return (
    <Link
      href={item.href}
      className={`block py-2 pl-6 pr-2 text-sm transition-colors ${
        active ? 'font-semibold text-blue-700' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {item.label}
    </Link>
  )
}
