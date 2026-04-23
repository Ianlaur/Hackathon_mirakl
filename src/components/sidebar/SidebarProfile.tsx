'use client'

type SidebarProfileProps = {
  name?: string
  role?: string
}

function initialsFromName(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
}

export default function SidebarProfile({
  name = 'Jean-Charles',
  role = 'Responsable e-commerce',
}: SidebarProfileProps) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-semibold text-white">
          {initialsFromName(name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">{role}</p>
        </div>
      </div>
    </div>
  )
}
