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
      className={`block rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
        active ? 'font-semibold text-blue-700' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      {item.label}
    </Link>
  )
}
