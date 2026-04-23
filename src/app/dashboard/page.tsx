'use client'

// MIRA — home screen. Atlas-first per spec UX hierarchy.
// PRIMAIRE: map + stock health + pending/handled counts + chat access (Orb).
// Detailed tables live in plugin pages (/actions, /activity, /stock, etc).

import AtlasHome from '@/components/atlas/AtlasHome'

export default function DashboardPage() {
  return <AtlasHome />
}
