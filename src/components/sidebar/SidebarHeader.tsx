'use client'

type SidebarHeaderProps = {
  title?: string
  subtitle?: string
}

export default function SidebarHeader({
  title = 'MIRAKL CONNECT',
  subtitle = 'Operations',
}: SidebarHeaderProps) {
  return (
    <div className="px-6 pb-4 pt-6">
      <div className="text-xl font-black text-slate-900 tracking-widest font-serif">{title}</div>
      <div className="text-xs text-slate-400 uppercase mt-1 tracking-wider">{subtitle}</div>
    </div>
  )
}
