'use client'

import DayBriefing from '@/components/copilot/DayBriefing'
import QuickActions from '@/components/copilot/QuickActions'
import SmartChat from '@/components/copilot/SmartChat'
import type { DayBriefingData } from '@/types/copilot'

type LegacyProps = {
  config?: unknown
  sessions?: unknown
  recommendations?: unknown
  executions?: unknown
}

const LEGACY_FALLBACK_BRIEFING: DayBriefingData = {
  dateLabel: new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date()),
  summary: 'Vos priorites sont pretes pour demarrer la journee.',
  tags: [
    { label: 'Suivi du jour', level: 'attention' },
    { label: 'Stocks a verifier', level: 'attention' },
    { label: 'Flux en cours', level: 'ok' },
  ],
  metrics: {
    activeShipments: 20,
    blockedOrders: 3,
    stockAlerts: 2,
  },
}

export default function CopilotPageClient(_props: LegacyProps) {
  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Copilot Mira</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Vos priorites, sans detour
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Tout est ici pour demarrer la journee rapidement.
        </p>
      </header>

      <div className="space-y-5">
        <DayBriefing initialBriefing={LEGACY_FALLBACK_BRIEFING} />
        <QuickActions stockAlertCount={LEGACY_FALLBACK_BRIEFING.metrics.stockAlerts} />
        <SmartChat />
      </div>
    </div>
  )
}
