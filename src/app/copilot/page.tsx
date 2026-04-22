import { headers } from 'next/headers'
import DayBriefing from '@/components/copilot/DayBriefing'
import QuickActions from '@/components/copilot/QuickActions'
import SmartChat from '@/components/copilot/SmartChat'
import { getDayBriefing } from '@/lib/dust'
import type { DayBriefingData } from '@/types/copilot'

export const dynamic = 'force-dynamic'

async function fetchBriefingSSR(): Promise<DayBriefingData> {
  const fallback = await getDayBriefing()

  try {
    const headerStore = headers()
    const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    const proto = headerStore.get('x-forwarded-proto') ?? 'http'

    if (!host) return fallback

    const response = await fetch(`${proto}://${host}/api/dust/briefing`, {
      method: 'GET',
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.briefing) return fallback

    return payload.briefing as DayBriefingData
  } catch {
    return fallback
  }
}

export default async function CopilotPage() {
  const briefing = await fetchBriefingSSR()

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
        <DayBriefing initialBriefing={briefing} />
        <QuickActions stockAlertCount={briefing.metrics.stockAlerts} />
        <SmartChat />
      </div>
    </div>
  )
}
