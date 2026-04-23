'use client'

type SidebarHeaderProps = {
  title?: string
  subtitle?: string
}

export default function SidebarHeader({
  title = 'MIRAKL TOWER',
  subtitle = 'Jean-Charles Store',
}: SidebarHeaderProps) {
  return (
    <div className="px-5 pb-4 pt-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white">
          M
        </div>
        <div>
          <p className="text-lg font-bold uppercase tracking-[0.14em] text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
