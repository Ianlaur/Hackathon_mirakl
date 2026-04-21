'use client'

import type { ReactNode } from 'react'
import { useSidebar } from '@/contexts/SidebarContext'
import Sidebar from '@/components/Sidebar'

export default function AppShell({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef3f9_100%)]">
      <Sidebar />
      <main
        className={`min-h-screen transition-all duration-300 ${
          isCollapsed ? 'ml-0 lg:ml-20' : 'ml-0 lg:ml-64'
        }`}
      >
        <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
