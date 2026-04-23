'use client'

import { Building2 } from 'lucide-react'

type SidebarHeaderProps = {
  title?: string
  subtitle?: string
}

export default function SidebarHeader({
  title = 'MIRAKL TOWER',
  subtitle = 'Jean-Charles',
}: SidebarHeaderProps) {
  return (
    <div className="px-5 pb-4 pt-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold uppercase tracking-[0.14em] text-slate-900">{title}</p>
          <p className="truncate text-xs font-normal text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
