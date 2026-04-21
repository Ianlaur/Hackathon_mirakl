'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSidebar } from '@/contexts/SidebarContext'

const navigation = [
  { href: '/dashboard', label: 'Dashboard', short: 'DB' },
  { href: '/app-store', label: 'App Store', short: 'AS' },
  { href: '/copilot', label: 'Copilot', short: 'AI' },
  { href: '/planning', label: 'Planning', short: 'PL' },
  { href: '/settings', label: 'Paramètres', short: 'PR' },
  { href: '/stock', label: 'Stock', short: 'ST' },
  { href: '/wms', label: 'Entrepôt', short: 'WM' },
  { href: '/parcels', label: 'Transport', short: 'TR' },
  { href: '/calendar', label: 'Calendrier', short: 'CA' },
  { href: '/losses', label: 'Suivi des pertes', short: 'SP' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  return (
    <>
      {isMobileOpen && (
        <button
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <button
        onClick={() => setIsMobileOpen((value) => !value)}
        className="fixed left-4 top-4 z-50 rounded-xl bg-slate-950 p-2 text-white shadow-lg lg:hidden"
        aria-label="Open navigation"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-8 flex items-center justify-between">
            {!isCollapsed && (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Hackathon</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">Mirakl</p>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Toggle sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isCollapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
                />
              </svg>
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className={`text-xs uppercase tracking-[0.24em] text-slate-500 ${isCollapsed ? 'hidden' : 'block'}`}>
              Workspace
            </p>
            {!isCollapsed && <p className="mt-2 text-sm text-slate-300">Only live routes are shown in this build.</p>}
          </div>

          <nav className="mt-6 space-y-2">
            {navigation.map((item) => {
              const active = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold">
                    {item.short}
                  </span>
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/20 to-cyan-400/10 p-4">
            {!isCollapsed ? (
              <>
                <p className="text-sm font-semibold">Hackathon User</p>
                <p className="mt-1 text-xs text-slate-300">hackathon@local</p>
              </>
            ) : (
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold">
                H
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
