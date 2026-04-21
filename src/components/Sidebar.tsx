'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useSidebar } from '@/contexts/SidebarContext'

interface Notification {
  id: string
  type: 'invitation'
  project: { id: string; title: string }
  owner: { name: string | null; email: string; profile_image_url: string | null }
  invited_at: string
  invitation_token: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const session = {
    user: {
      name: 'Hackathon User',
      email: 'hackathon@local',
      has_inventory: true,
      has_srm: false,
      beta_features_enabled: true,
    },
  }
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/collaboration')
        if (response.ok) {
          const data = await response.json()
          setNotifications((data.pending || []).map((inv: any) => ({
            id: inv.id,
            type: 'invitation' as const,
            project: inv.project,
            owner: inv.owner,
            invited_at: inv.invited_at,
            invitation_token: inv.invitation_token
          })))
        }
      } catch (err) {
        console.error('Error fetching notifications:', err)
      }
    }
    
    if (session?.user) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  // Close notification dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAcceptInvitation = async (notification: Notification) => {
    try {
      const response = await fetch(`/api/collaboration/accept/${notification.invitation_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })
      if (response.ok) {
        setShowNotifications(false)
        router.push(`/project/${notification.project.id}`)
        setNotifications(prev => prev.filter(n => n.id !== notification.id))
      }
    } catch (err) {
      console.error('Error accepting invitation:', err)
    }
  }

  const handleDeclineInvitation = async (notification: Notification) => {
    try {
      const response = await fetch(`/api/collaboration/accept/${notification.invitation_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' })
      })
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notification.id))
      }
    } catch (err) {
      console.error('Error declining invitation:', err)
    }
  }

  const handleLogout = () => {
    router.push('/settings')
  }

  const getUserInitial = () => {
    if (session?.user?.name) {
      return session.user.name.charAt(0).toUpperCase()
    }
    if (session?.user?.email) {
      return session.user.email.charAt(0).toUpperCase()
    }
    return 'U'
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#242832] text-white shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <aside className={`
        fixed left-0 top-0 h-screen bg-[#1a1d24]
        transition-all duration-300 z-50 overflow-hidden
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="flex flex-col h-full p-4">
        {/* Logo & Toggle */}
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-white">
              <img src="/logoNai.svg" alt="lauria" className="h-9 w-9 invert" />
              lauria
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-[#5353ff] transition-colors text-[#7e8590] hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden">
          {/* Main Navigation */}
          <div className="space-y-2">
            <NavItem
              href="/dashboard"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
              label="Dashboard"
              isActive={pathname === '/dashboard'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/projects"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              }
              label="Projets"
              isActive={pathname === '/projects' || pathname?.startsWith('/project/')}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/clients"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              label="Clients"
              isActive={pathname === '/clients'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/leads"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              }
              label="Leads"
              isActive={pathname === '/leads'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/invoices"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              }
              label="Factures"
              isActive={pathname === '/invoices'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/quotes"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="Devis"
              isActive={pathname === '/quotes'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/contracts"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="Contrats"
              isActive={pathname === '/contracts'}
              isCollapsed={isCollapsed}
            />
            {/* Stock Management - For users with inventory enabled */}
            {session?.user?.has_inventory && (
              <NavItem
                href="/stock"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                label="Stock"
                isActive={pathname === '/stock'}
                isCollapsed={isCollapsed}
              />
            )}
            {/* WMS - Warehouse Management System - For users with inventory enabled */}
            {session?.user?.has_inventory && (
              <NavItem
                href="/wms"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                }
                label="Entrepôt"
                isActive={pathname === '/wms'}
                isCollapsed={isCollapsed}
              />
            )}
            {/* Parcel Tracking - For users with inventory enabled */}
            {session?.user?.has_inventory && (
              <NavItem
                href="/parcels"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                }
                label="Transport"
                isActive={pathname === '/parcels'}
                isCollapsed={isCollapsed}
              />
            )}
            {/* SRM - Supplier Relationship Management - For users with SRM enabled */}
            {session?.user?.has_srm && (
              <NavItem
                href="/srm/suppliers"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                label="Fournisseurs"
                isActive={pathname?.startsWith('/srm')}
                isCollapsed={isCollapsed}
              />
            )}
            <NavItem
              href="/urssaf"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              label="URSSAF"
              isActive={pathname === '/urssaf'}
              isCollapsed={isCollapsed}
            />
            {/* Beta Features - Only for users with beta enabled */}
            {session?.user?.beta_features_enabled && (
              <>
                <NavItem
                  href="/expenses"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  label="Dépenses"
                  isActive={pathname === '/expenses'}
                  isCollapsed={isCollapsed}
                  badge="BETA"
                />
                <NavItem
                  href="/e-reputation"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.914c.969 0 1.371 1.24.588 1.81l-3.976 2.89a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.54 1.118l-3.976-2.89a1 1 0 00-1.176 0l-3.976 2.89c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.89c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.95-.69l1.519-4.674z" />
                    </svg>
                  }
                  label="E-reputation"
                  isActive={pathname === '/e-reputation'}
                  isCollapsed={isCollapsed}
                  badge="BETA"
                />
              </>
            )}
          </div>

          <div className="border-t border-[#42434a]"></div>

          {/* Tools */}
          <div className="space-y-2">
            <NavItem
              href="/client-access"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 1.657-1.343 3-3 3S6 12.657 6 11s1.343-3 3-3 3 1.343 3 3zm0 0c0 1.657 1.343 3 3 3s3-1.343 3-3-1.343-3-3-3-3 1.343-3 3zm0 0v6m-6 4h12" />
                </svg>
              }
              label="Accès clients"
              isActive={pathname === '/client-access'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              href="/settings"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              label="Paramètres"
              isActive={pathname === '/settings'}
              isCollapsed={isCollapsed}
            />
          </div>

          <div className="border-t border-[#42434a]"></div>

          {/* User Section */}
          <div className="space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#7e8590] hover:bg-red-500/15 hover:text-red-400 transition-colors"
              title={isCollapsed ? "Déconnexion" : ""}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!isCollapsed && <span className="font-semibold">Déconnexion</span>}
            </button>
          </div>
        </div>

        {/* User Profile */}
        {!isCollapsed ? (
          <div className="mt-auto pt-4 border-t border-[#42434a] space-y-3">
            {/* Notification Bell */}
            {notifications.length > 0 && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-all"
                >
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  </div>
                  <span className="font-semibold">{notifications.length} invitation{notifications.length > 1 ? 's' : ''}</span>
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[100]">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Invitations en attente</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div key={notification.id} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                              {notification.owner.name?.charAt(0) || notification.owner.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.project.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                De {notification.owner.name || notification.owner.email}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleAcceptInvitation(notification)}
                                  className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                  Accepter
                                </button>
                                <button
                                  onClick={() => handleDeclineInvitation(notification)}
                                  className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                >
                                  Refuser
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* User Info */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#5353ff]/10">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                {getUserInitial()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{session?.user?.name || 'Utilisateur'}</p>
                <p className="text-xs text-[#7e8590] truncate">{session?.user?.email || ''}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-4 border-t border-[#42434a] space-y-2">
            {/* Collapsed notification bell */}
            {notifications.length > 0 && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-full flex items-center justify-center p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-all"
                  title={`${notifications.length} invitation(s)`}
                >
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  </div>
                </button>

                {/* Collapsed dropdown - shows to the right */}
                {showNotifications && (
                  <div className="absolute bottom-0 left-full ml-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[100]">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Invitations en attente</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div key={notification.id} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                              {notification.owner.name?.charAt(0) || notification.owner.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.project.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                De {notification.owner.name || notification.owner.email}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleAcceptInvitation(notification)}
                                  className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                  Accepter
                                </button>
                                <button
                                  onClick={() => handleDeclineInvitation(notification)}
                                  className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                >
                                  Refuser
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Collapsed user avatar */}
            <div className="flex items-center justify-center p-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium" title={session?.user?.name || session?.user?.email || 'Utilisateur'}>
                {getUserInitial()}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}

function NavItem({ 
  href, 
  icon, 
  label, 
  isActive, 
  isCollapsed,
  badge
}: { 
  href: string
  icon: React.ReactNode
  label: string
  isActive: boolean
  isCollapsed: boolean
  badge?: string
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
        ${isActive 
          ? 'bg-[#5353ff] text-white' 
          : 'text-[#7e8590] hover:bg-[#5353ff] hover:text-white'
        }
      `}
      title={isCollapsed ? label : ""}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!isCollapsed && (
        <span className="flex items-center gap-2">
          {label}
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
              {badge}
            </span>
          )}
        </span>
      )}
    </Link>
  )
}
