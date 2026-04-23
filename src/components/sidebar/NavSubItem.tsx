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
      className={`block rounded-md py-2 px-3 font-serif text-sm transition-all duration-200 ${
        active ? 'bg-slate-50 font-medium text-[#2764ff] border border-slate-200' : 'text-[#6B7480] hover:bg-slate-50 hover:text-[#03182F]'
      }`}
    >
      {item.label}
    </Link>
  )
}
