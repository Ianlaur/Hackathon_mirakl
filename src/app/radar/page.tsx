'use client'

// MIRA RADAR — carrier audit + supplier scorecard + profit recovery.
// Spec: PLUGIN tab (own sidebar entry). Never surfaced on the home screen.

import { useEffect, useState } from 'react'
import { Truck, Factory, TrendingUp } from 'lucide-react'
import { SimulatedBadge } from '@/components/SimulatedBadge'

type CarrierRow = {
  sku: string
  returns: number
  damage_returns: number
  orders: number
  damage_rate: number
}

type SupplierRow = {
  supplier: string
  skus: number
  avg_lead_time_days: number
  total_min_order: number
  avg_unit_cost_eur: number
  observed_return_rate: number
  is_simulated: boolean
}

type RadarData = {
  window_days: number
  carrier_audit: CarrierRow[]
  supplier_scorecard: SupplierRow[]
  profit_recovery: { estimated_eur: number; source: string }
}

export default function RadarPage() {
  const [data, setData] = useState<RadarData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const resp = await fetch('/api/mira/radar', { cache: 'no-store' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        setData(await resp.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'load failed')
      }
    })()
  }, [])

  if (error) {
    return (
      <div className="mira-card p-6 text-sm">
        <div className="mira-label">RADAR · erreur</div>
        <p className="mt-2 text-slate-700">{error}</p>
      </div>
    )
  }

  if (!data) {
    return <div className="mira-card h-[60vh] animate-pulse" aria-hidden />
  }

  return (
    <div className="space-y-4">
      <header className="mira-card mira-card--raised flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <div className="mira-label">Plugin</div>
          <h1 className="mira-display text-[22px] font-bold">MIRA RADAR</h1>
          <p className="mt-1 text-xs text-slate-600">
            Audit transporteur · fiche fournisseur · potentiel de récupération ({data.window_days} derniers jours)
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[color:var(--mira-blue-soft)] px-4 py-3">
          <TrendingUp className="h-4 w-4 text-[color:var(--mira-blue)]" />
          <div>
            <div className="mira-label">Récupération potentielle</div>
            <div className="mira-display text-[18px] font-bold text-[color:var(--mira-blue)]">
              {formatEur(data.profit_recovery.estimated_eur)}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="mira-card mira-card--raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[color:var(--mira-blue)]" />
              <h2 className="mira-display text-[16px] font-bold">Audit transporteur</h2>
            </div>
            <span className="mira-label">top {data.carrier_audit.length}</span>
          </div>
          {data.carrier_audit.length === 0 ? (
            <EmptyState message="Aucune casse détectée sur la fenêtre." />
          ) : (
            <ul className="space-y-2">
              {data.carrier_audit.map((row) => (
                <li key={row.sku} className="mira-card flex items-center justify-between gap-3 p-3">
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--mira-ink)]">{row.sku}</div>
                    <div className="text-xs text-slate-600">
                      {row.damage_returns} casses / {row.returns} retours / {row.orders} commandes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mira-display text-[16px] font-bold text-[color:var(--mira-pink)]">
                      {row.damage_rate}%
                    </div>
                    <div className="mira-label">taux de casse</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mira-card mira-card--raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-[color:var(--mira-blue)]" />
              <h2 className="mira-display text-[16px] font-bold">Fiche fournisseur</h2>
            </div>
            <span className="mira-label">top {data.supplier_scorecard.length}</span>
          </div>
          {data.supplier_scorecard.length === 0 ? (
            <EmptyState message="Pas de données fournisseur dans cette fenêtre." />
          ) : (
            <ul className="space-y-2">
              {data.supplier_scorecard.map((row) => (
                <li key={row.supplier} className="mira-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[color:var(--mira-ink)]">{row.supplier}</span>
                        {row.is_simulated ? <SimulatedBadge label="SIMULÉ" /> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {row.skus} SKUs · lead time moyen {row.avg_lead_time_days}j · MOQ cumulé {row.total_min_order}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mira-display text-[14px] font-bold">
                        {formatEur(row.avg_unit_cost_eur)}
                      </div>
                      <div className="mira-label">coût unitaire moyen</div>
                      <div className="mt-1 text-[11px] text-[color:var(--mira-pink)]">
                        {row.observed_return_rate}% retours
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-[color:var(--mira-bg)] p-4 text-xs text-slate-600">{message}</div>
  )
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
