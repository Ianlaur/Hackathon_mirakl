'use client'

// MIRA — Atlas home screen. PRIMAIRE per UX hierarchy.
// Answers the 3 founder questions in 3 seconds:
//   1) Everything OK?       → stock health gauge
//   2) Something waiting?   → pink pulses + pending count
//   3) MIRA did what?       → blue pulses + handled count
// Chat access is always-on via MascotOrb (rendered in AppShell).

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type StorefrontSignal = {
  channel: string
  region: 'FR' | 'IT' | 'DE'
  orders_24h: number
  revenue_24h: number
  pending_decisions: number
  handled_24h: number
  shielded: boolean
}

type RegionSignal = {
  region: 'FR' | 'IT' | 'DE'
  orders_24h: number
  revenue_24h: number
  pending_decisions: number
  handled_24h: number
  shielded: boolean
  storefronts: StorefrontSignal[]
}

type AtlasData = {
  updated_at: string
  founder: { state: string; until: string | null }
  shield: {
    primary_channel: string | null
    paused_channels: string[]
    activated_at: string | null
    active: boolean
  }
  stock: { total_skus: number; at_risk: number; healthy: number; health_pct: number }
  totals: { orders_24h: number; revenue_24h: number; pending_decisions: number; handled_24h: number }
  regions: RegionSignal[]
}

// Approximate geographic anchors within the 800×520 viewBox.
const REGION_POS: Record<'FR' | 'IT' | 'DE', { x: number; y: number; label: string }> = {
  FR: { x: 260, y: 300, label: 'France' },
  DE: { x: 500, y: 200, label: 'Deutschland' },
  IT: { x: 430, y: 400, label: 'Italia' },
}

export default function AtlasHome() {
  const [data, setData] = useState<AtlasData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/mira/atlas', { cache: 'no-store' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const payload: AtlasData = await resp.json()
      setData(payload)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load failed')
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 15000)
    return () => window.clearInterval(id)
  }, [load])

  // Live-refresh Atlas whenever a decision lands in the ledger.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    const channel = supabase
      .channel('atlas-ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decision_ledger' }, () => {
        load()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  if (error) {
    return (
      <div className="mira-card mira-card--raised p-6 text-sm">
        <div className="mira-label mb-2">Atlas · erreur</div>
        <p className="text-slate-700">Impossible de charger les signaux ({error}).</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mira-card mira-card--raised h-[520px] animate-pulse" aria-hidden />
    )
  }

  const founderAway = data.founder.state === 'Vacation' || data.founder.state === 'Sick'

  return (
    <div className="space-y-4">
      <AtlasHeader data={data} founderAway={founderAway} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <AtlasMap data={data} />
        <AtlasSidebar data={data} />
      </div>
    </div>
  )
}

function AtlasHeader({ data, founderAway }: { data: AtlasData; founderAway: boolean }) {
  const healthTone = data.stock.health_pct >= 85 ? 'healthy' : data.stock.health_pct >= 60 ? 'warn' : 'alert'
  return (
    <section className="mira-card mira-card--raised flex flex-wrap items-center gap-6 px-6 py-5">
      <div>
        <div className="mira-label">Atlas</div>
        <h1 className="mira-display text-[22px] font-bold text-[color:var(--mira-ink)]">Bonjour Marie</h1>
      </div>
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <KpiTile label="Commandes 24h" value={String(data.totals.orders_24h)} />
        <KpiTile label="Revenus 24h" value={formatEur(data.totals.revenue_24h)} />
        <HealthGauge pct={data.stock.health_pct} tone={healthTone} atRisk={data.stock.at_risk} />
        <KpiTile label="En attente" value={String(data.totals.pending_decisions)} tone={data.totals.pending_decisions > 0 ? 'alert' : undefined} />
        <KpiTile label="MIRA a géré" value={String(data.totals.handled_24h)} tone="accent" />
      </div>
      {founderAway ? (
        <div className="ml-auto flex items-center gap-2 rounded-full bg-[color:var(--mira-pink-soft)] px-4 py-1.5 text-xs font-semibold text-[color:var(--mira-pink)]">
          Reputation Shield actif · canal protégé: {data.shield.primary_channel ?? 'n/a'}
        </div>
      ) : null}
    </section>
  )
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'alert' }) {
  const color =
    tone === 'accent'
      ? 'text-[color:var(--mira-blue)]'
      : tone === 'alert'
        ? 'text-[color:var(--mira-pink)]'
        : 'text-[color:var(--mira-ink)]'
  return (
    <div>
      <div className="mira-label">{label}</div>
      <div className={`mira-display text-[18px] font-bold ${color}`}>{value}</div>
    </div>
  )
}

function HealthGauge({ pct, tone, atRisk }: { pct: number; tone: 'healthy' | 'warn' | 'alert'; atRisk: number }) {
  const color =
    tone === 'healthy' ? 'var(--mira-blue)' : tone === 'warn' ? '#F5A524' : 'var(--mira-pink)'
  const ringStyle = {
    background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(3,24,47,0.08) 0)`,
  } as const
  const label =
    tone === 'healthy'
      ? 'Stock sain'
      : tone === 'warn'
        ? `${atRisk} SKU sous surveillance`
        : `${atRisk} SKU en risque`
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-14 w-14 place-items-center rounded-full"
        style={ringStyle}
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white">
          <span className="mira-display text-[14px] font-bold" style={{ color }}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="text-xs text-slate-600">
        <div className="mira-label">Santé stock</div>
        <div className="mt-1">{label}</div>
      </div>
    </div>
  )
}

function AtlasMap({ data }: { data: AtlasData }) {
  return (
    <div className="mira-card mira-card--raised relative overflow-hidden p-4" style={{ minHeight: 520 }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="mira-label">Atlas · Europe</div>
          <h2 className="mira-display text-[18px] font-bold">3 pays · 6 storefronts</h2>
        </div>
        <LegendDot color="var(--mira-pink)" label="en attente" />
        <LegendDot color="var(--mira-blue)" label="MIRA a géré" />
        <LegendDot color="#F5A524" label="shield actif" />
      </div>

      <svg viewBox="0 0 800 520" className="mt-2 h-[440px] w-full">
        <defs>
          <radialGradient id="country-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E9F0FF" />
            <stop offset="100%" stopColor="#F2F8FF" />
          </radialGradient>
          <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Simple country blobs — not geographically precise, but reads as Europe. */}
        <CountryBlob cx={260} cy={300} r={120} />
        <CountryBlob cx={500} cy={200} r={110} />
        <CountryBlob cx={430} cy={400} r={90} />

        {/* Soft line between FR and the other regions to suggest flow (no animation). */}
        <path d="M 260 300 Q 400 220 500 200" stroke="rgba(39,100,255,0.18)" strokeWidth={2} fill="none" />
        <path d="M 260 300 Q 345 370 430 400" stroke="rgba(39,100,255,0.18)" strokeWidth={2} fill="none" />

        {data.regions.map((region) => (
          <RegionNode key={region.region} region={region} />
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {data.regions.map((region) => (
          <RegionCard key={region.region} region={region} />
        ))}
      </div>
    </div>
  )
}

function CountryBlob({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#country-fill)" filter="url(#soft-shadow)" />
      <circle cx={cx} cy={cy} r={r} fill="url(#country-fill)" stroke="rgba(3,24,47,0.06)" />
    </g>
  )
}

function RegionNode({ region }: { region: RegionSignal }) {
  const pos = REGION_POS[region.region]
  const pending = region.pending_decisions
  const handled = region.handled_24h
  const pulseColor = pending > 0 ? 'var(--mira-pink)' : 'var(--mira-blue)'
  const pulseOpacity = pending > 0 || handled > 0 ? 0.92 : 0.35

  return (
    <g transform={`translate(${pos.x}, ${pos.y})`}>
      <circle r={20} fill={pulseColor} opacity={pulseOpacity} />
      <circle r={28} fill="none" stroke={pulseColor} strokeOpacity={0.35} strokeWidth={2}>
        <animate attributeName="r" values="24;34;24" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <text y={-30} textAnchor="middle" className="mira-display" fontSize={14} fontWeight={700} fill="var(--mira-ink)">
        {pos.label}
      </text>
      <text y={56} textAnchor="middle" fontSize={11} fill="rgba(3,24,47,0.6)">
        {region.orders_24h} commandes · {formatEur(region.revenue_24h)}
      </text>
      {region.shielded ? (
        <circle r={38} fill="none" stroke="#F5A524" strokeOpacity={0.55} strokeWidth={2.5} strokeDasharray="5 4" />
      ) : null}
    </g>
  )
}

function RegionCard({ region }: { region: RegionSignal }) {
  const pending = region.pending_decisions
  const handled = region.handled_24h
  const stores = region.storefronts
  return (
    <div className="mira-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="mira-label">{REGION_POS[region.region].label}</div>
          <div className="mira-display text-[14px] font-bold">{region.orders_24h} commandes</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {pending > 0 ? (
            <span className="rounded-full bg-[color:var(--mira-pink-soft)] px-2 py-0.5 font-semibold text-[color:var(--mira-pink)]">
              {pending} en attente
            </span>
          ) : null}
          {handled > 0 ? (
            <span className="rounded-full bg-[color:var(--mira-blue-soft)] px-2 py-0.5 font-semibold text-[color:var(--mira-blue)]">
              {handled} géré
            </span>
          ) : null}
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {stores.map((s) => (
          <li key={s.channel} className="flex items-center justify-between gap-2">
            <span className="truncate">{prettyChannel(s.channel)}</span>
            <span className="tabular-nums">{s.orders_24h}</span>
            {s.shielded ? <span className="text-[10px] font-semibold text-[#F5A524]">shield</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function AtlasSidebar({ data }: { data: AtlasData }) {
  const founder = data.founder
  return (
    <aside className="space-y-4">
      <div className="mira-card mira-card--raised p-4">
        <div className="mira-label">État fondateur</div>
        <h3 className="mira-display text-[16px] font-bold capitalize">{founder.state.toLowerCase()}</h3>
        {founder.until ? (
          <p className="mt-1 text-xs text-slate-600">Reprise prévue {formatShortDate(founder.until)}</p>
        ) : null}
      </div>
      {data.shield.active ? (
        <div className="mira-card p-4" style={{ borderLeft: '3px solid var(--mira-pink)' }}>
          <div className="mira-label">Reputation Shield</div>
          <p className="mt-1 text-xs text-slate-700">
            Canal principal protégé: <strong>{prettyChannel(data.shield.primary_channel ?? '')}</strong>. Exposition
            réduite sur {data.shield.paused_channels.length} storefronts.
          </p>
        </div>
      ) : null}
      <div className="mira-card p-4">
        <div className="mira-label">Synthèse 24h</div>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          <li className="flex justify-between"><span>Commandes</span><span className="tabular-nums">{data.totals.orders_24h}</span></li>
          <li className="flex justify-between"><span>Revenus</span><span className="tabular-nums">{formatEur(data.totals.revenue_24h)}</span></li>
          <li className="flex justify-between"><span>En attente</span><span className="tabular-nums">{data.totals.pending_decisions}</span></li>
          <li className="flex justify-between"><span>Auto-exécutées</span><span className="tabular-nums">{data.totals.handled_24h}</span></li>
        </ul>
      </div>
    </aside>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="ml-3 flex items-center gap-1.5 text-xs text-slate-600">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}

function prettyChannel(channel: string): string {
  const map: Record<string, string> = {
    amazon_fr: 'Amazon FR',
    amazon_it: 'Amazon IT',
    amazon_de: 'Amazon DE',
    google_shopping_fr: 'Google Shopping FR',
    google_shopping_it: 'Google Shopping IT',
    google_shopping_de: 'Google Shopping DE',
  }
  return map[channel] ?? channel
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
