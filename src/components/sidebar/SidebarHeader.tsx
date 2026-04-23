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
      <div className="font-serif text-lg font-bold tracking-widest text-[#03182F]">{title}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-[#6B7480]">{subtitle}</div>
    </div>
  )
}
