'use client'

import { useMemo, useState } from 'react'

export type LossEvent = {
  id: string
  occurredAt: string
  detectedAt: string
  sourceTable: string
  sourceLine: number | null
  sourceOrderRef: string
  productCatalogId: string
  sku: string
  productName: string
  category: string
  quantityLost: number
  orderedQuantity: number | null
  unitCost: number | null
  orderUnitPrice: number | null
  estimatedLossValue: number
  detectedStage: string
  locationLabel: string
  reasonCategory: string
  reasonDetail: string
  confidence: string
  status: string
  carrierName: string
  marketplace: string
  supplierName: string
  notes: string
  createdAt: string
  updatedAt: string
}

type Props = {
  initialEvents: LossEvent[]
  loadError?: string
}

type GroupMetric = {
  key: string
  label: string
  count: number
  quantity: number
  value: number
}

type MetricKey = 'value' | 'quantity' | 'active' | 'stage' | 'reason' | 'carrier'

const stageLabels: Record<string, string> = {
  carrier_transit: 'Transporteur',
  receiving: 'Réception',
  storage: 'Stockage',
  picking: 'Picking',
  packing: 'Emballage',
  shipping: 'Expédition',
  customer_return: 'Retour client',
  inventory_count: 'Inventaire',
  marketplace_adjustment: 'Marketplace',
}

const reasonLabels: Record<string, string> = {
  damaged: 'Casse / abîmé',
  lost_in_transit: 'Perdu transport',
  inventory_mismatch: 'Écart inventaire',
  picking_error: 'Erreur picking',
  supplier_shortage: 'Manquant fournisseur',
  return_unsellable: 'Retour invendable',
  theft_suspected: 'Vol suspecté',
  manual_adjustment: 'Ajustement manuel',
}

const statusLabels: Record<string, { label: string; className: string }> = {
  open: { label: 'Ouvert', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  investigating: { label: 'En analyse', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  resolved: { label: 'Résolu', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  ignored: { label: 'Ignoré', className: 'bg-slate-100 text-[#6B7480] ring-slate-200' },
}

const confidenceLabels: Record<string, string> = {
  suspected: 'Suspecté',
  likely: 'Probable',
  confirmed: 'Confirmé',
}

const stageAccent: Record<string, string> = {
  carrier_transit: 'bg-[#2764ff]',
  receiving: 'bg-emerald-500',
  storage: 'bg-cyan-500',
  picking: 'bg-amber-500',
  packing: 'bg-orange-500',
  shipping: 'bg-rose-500',
  customer_return: 'bg-violet-500',
  inventory_count: 'bg-slate-600',
  marketplace_adjustment: 'bg-fuchsia-500',
}

const pieColors = ['#2563eb', '#16a34a', '#f59e0b', '#e11d48', '#7c3aed', '#0891b2', '#475569', '#db2777']

function labelFromMap(map: Record<string, string>, value: string) {
  return map[value] || value || 'Non renseigné'
}

function euro(value: number | null) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0)
}

function number(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function dateFr(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

function groupBy(events: LossEvent[], keyGetter: (event: LossEvent) => string, labelGetter: (key: string) => string) {
  const grouped = new Map<string, GroupMetric>()

  for (const event of events) {
    const key = keyGetter(event) || 'unknown'
    const current = grouped.get(key) || { key, label: labelGetter(key), count: 0, quantity: 0, value: 0 }
    current.count += 1
    current.quantity += event.quantityLost
    current.value += event.estimatedLossValue
    grouped.set(key, current)
  }

  return Array.from(grouped.values()).sort((a, b) => b.value - a.value)
}

function uniqueValues(events: LossEvent[], getter: (event: LossEvent) => string) {
  return Array.from(new Set(events.map(getter).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function PieDistribution({ title, items }: { title: string; items: GroupMetric[] }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const visibleItems = items.slice(0, 8)
  const totalValue = items.reduce((sum, item) => sum + item.value, 0)
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const activeItem = visibleItems.find((item) => item.key === hoveredKey) || visibleItems[0]
  const activeIndex = Math.max(
    0,
    visibleItems.findIndex((item) => item.key === activeItem?.key)
  )
  const activePercent = activeItem && totalValue > 0 ? Math.round((activeItem.value / totalValue) * 100) : 0

  return (
    <section className="dashboard-card min-w-0 overflow-hidden p-5">
      <h2 className="break-words text-lg font-semibold text-[#03182F]">{title}</h2>
      {items.length > 0 ? (
        <div className="mt-5 min-w-0 space-y-4">
          <div className="relative mx-auto h-44 w-44">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90 overflow-visible" role="img" aria-label={title}>
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="24" />
              {visibleItems.map((item, index) => {
                const segment = totalValue > 0 ? (item.value / totalValue) * circumference : 0
                const dashOffset = -offset
                offset += segment
                const active = activeItem?.key === item.key

                return (
                  <circle
                    key={item.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={pieColors[index % pieColors.length]}
                    strokeWidth={active ? 30 : 24}
                    strokeDasharray={`${Math.max(0, segment - 1)} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-150"
                    tabIndex={0}
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onFocus={() => setHoveredKey(item.key)}
                  />
                )
              })}
            </svg>
            <div className="pointer-events-none absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-sm">
              <span className="text-xl font-semibold text-[#03182F]">{totalCount}</span>
              <span className="text-xs font-medium text-[#6B7480]">événements</span>
            </div>
          </div>
          <div
            className="min-w-0 rounded-2xl border border-[#DDE5EE] bg-[#F2F8FF] p-4"
            onMouseLeave={() => setHoveredKey(null)}
          >
            {activeItem ? (
              <>
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: pieColors[activeIndex % pieColors.length] }}
                  />
                  <div className="min-w-0">
                    <p className="break-words text-base font-semibold leading-6 text-[#03182F]">{activeItem.label}</p>
                    <p className="mt-1 text-sm leading-5 text-[#6B7480]">Survolez une portion pour changer le détail.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2">
                    <p className="text-xs text-[#6B7480]">Part</p>
                    <p className="mt-1 font-semibold text-[#03182F]">{activePercent}%</p>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <p className="text-xs text-[#6B7480]">Cas</p>
                    <p className="mt-1 font-semibold text-[#03182F]">{activeItem.count}</p>
                  </div>
                  <div className="rounded-xl bg-white p-2">
                    <p className="text-xs text-[#6B7480]">Unités</p>
                    <p className="mt-1 font-semibold text-[#03182F]">{number(activeItem.quantity)}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="text-xs text-[#6B7480]">Valeur estimée</p>
                  <p className="mt-1 break-words text-lg font-semibold text-[#03182F]">{euro(activeItem.value)}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#6B7480]">Survolez une portion du camembert.</p>
            )}
          </div>
          <div className="min-w-0">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {visibleItems.map((item, index) => {
                const active = activeItem?.key === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onFocus={() => setHoveredKey(item.key)}
                    className={`flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition ${
                      active ? 'border-slate-300 bg-white text-[#03182F] shadow-sm' : 'border-[#DDE5EE] bg-[#F2F8FF] text-[#6B7480] hover:bg-white'
                    }`}
                  >
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#6B7480]">Aucune donnée.</p>
      )}
    </section>
  )
}

export default function LossesPageClient({ initialEvents, loadError }: Props) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('all')
  const [reason, setReason] = useState('all')
  const [carrier, setCarrier] = useState('all')
  const [status, setStatus] = useState('all')
  const [marketplace, setMarketplace] = useState('all')
  const [selectedId, setSelectedId] = useState(initialEvents[0]?.id || null)
  const [activeMetric, setActiveMetric] = useState<MetricKey>('value')

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return initialEvents.filter((event) => {
      const matchesSearch =
        !query ||
        [event.sku, event.productName, event.sourceOrderRef, event.category, event.reasonDetail]
          .join(' ')
          .toLowerCase()
          .includes(query)
      const matchesStage = stage === 'all' || event.detectedStage === stage
      const matchesReason = reason === 'all' || event.reasonCategory === reason
      const matchesCarrier = carrier === 'all' || event.carrierName === carrier
      const matchesStatus = status === 'all' || event.status === status
      const matchesMarketplace = marketplace === 'all' || event.marketplace === marketplace

      return matchesSearch && matchesStage && matchesReason && matchesCarrier && matchesStatus && matchesMarketplace
    })
  }, [carrier, initialEvents, marketplace, reason, search, stage, status])

  const selectedEvent = filteredEvents.find((event) => event.id === selectedId) || filteredEvents[0] || null
  const totalValue = filteredEvents.reduce((sum, event) => sum + event.estimatedLossValue, 0)
  const totalQuantity = filteredEvents.reduce((sum, event) => sum + event.quantityLost, 0)
  const activeEvents = filteredEvents.filter((event) => ['open', 'investigating'].includes(event.status)).length
  const byStage = groupBy(filteredEvents, (event) => event.detectedStage, (key) => labelFromMap(stageLabels, key))
  const byReason = groupBy(filteredEvents, (event) => event.reasonCategory, (key) => labelFromMap(reasonLabels, key))
  const byCarrier = groupBy(filteredEvents, (event) => event.carrierName || 'Sans transporteur', (key) => key)
  const byProduct = groupBy(filteredEvents, (event) => event.sku, (key) => {
    const event = filteredEvents.find((item) => item.sku === key)
    return event ? `${event.sku} · ${event.productName}` : key
  })
  const topStage = byStage[0]
  const topReason = byReason[0]
  const topCarrier = byCarrier.find((item) => item.key !== 'Sans transporteur') || byCarrier[0]
  const metricEvents: Record<MetricKey, LossEvent[]> = {
    value: [...filteredEvents].sort((a, b) => b.estimatedLossValue - a.estimatedLossValue),
    quantity: [...filteredEvents].sort((a, b) => b.quantityLost - a.quantityLost),
    active: filteredEvents.filter((event) => ['open', 'investigating'].includes(event.status)),
    stage: topStage ? filteredEvents.filter((event) => event.detectedStage === topStage.key) : [],
    reason: topReason ? filteredEvents.filter((event) => event.reasonCategory === topReason.key) : [],
    carrier: topCarrier ? filteredEvents.filter((event) => (event.carrierName || 'Sans transporteur') === topCarrier.key) : [],
  }
  const metricSummaries: Record<MetricKey, { title: string; description: string }> = {
    value: {
      title: 'Valeur perdue',
      description: 'Les pertes les plus coûteuses, calculées avec le prix catalogue fournisseur quand il existe.',
    },
    quantity: {
      title: 'Unités perdues',
      description: 'Les références qui concentrent le plus grand volume de stock perdu.',
    },
    active: {
      title: 'À traiter',
      description: 'Les pertes encore ouvertes ou en cours d’analyse.',
    },
    stage: {
      title: 'Étape critique',
      description: topStage ? `Focus sur ${topStage.label}, l’étape qui pèse le plus en valeur.` : 'Aucune étape critique identifiée.',
    },
    reason: {
      title: 'Cause principale',
      description: topReason ? `Focus sur ${topReason.label}, la cause la plus importante en valeur.` : 'Aucune cause principale identifiée.',
    },
    carrier: {
      title: 'Transporteur',
      description: topCarrier ? `Focus sur ${topCarrier.label}, le transporteur le plus exposé en valeur.` : 'Aucun transporteur identifié.',
    },
  }
  const metrics: Array<{ key: MetricKey; label: string; value: string; detail: string }> = [
    { key: 'value', label: 'Valeur perdue', value: euro(totalValue), detail: `${filteredEvents.length} événements` },
    { key: 'quantity', label: 'Unités perdues', value: number(totalQuantity), detail: 'Quantité totale' },
    { key: 'active', label: 'À traiter', value: number(activeEvents), detail: 'Ouverts ou en analyse' },
    { key: 'stage', label: 'Étape critique', value: topStage?.label || '—', detail: topStage ? euro(topStage.value) : 'Aucune donnée' },
    { key: 'reason', label: 'Cause principale', value: topReason?.label || '—', detail: topReason ? `${topReason.count} cas` : 'Aucune donnée' },
    { key: 'carrier', label: 'Transporteur', value: topCarrier?.label || '—', detail: topCarrier ? euro(topCarrier.value) : 'Aucune donnée' },
  ]

  const stages = uniqueValues(initialEvents, (event) => event.detectedStage)
  const reasons = uniqueValues(initialEvents, (event) => event.reasonCategory)
  const carriers = uniqueValues(initialEvents, (event) => event.carrierName)
  const statuses = uniqueValues(initialEvents, (event) => event.status)
  const marketplaces = uniqueValues(initialEvents, (event) => event.marketplace)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="dashboard-card p-5 sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">Contrôle opérationnel</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#03182F]">Suivi des pertes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7480]">
            Une vue courte pour identifier les pertes, leurs causes et les acteurs concernés.
          </p>
        </div>
        {loadError && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{loadError}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => (
          <button
            key={metric.key}
            type="button"
            onClick={() => setActiveMetric(metric.key)}
            className={`dashboard-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
              activeMetric === metric.key ? 'ring-2 ring-rose-500' : ''
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7480]">{metric.label}</p>
            <p className="mt-3 truncate text-2xl font-semibold text-[#03182F]">{metric.value}</p>
            <p className="mt-1 text-sm text-[#6B7480]">{metric.detail}</p>
          </button>
        ))}
      </section>

      <section className="dashboard-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7480]">Détail KPI</p>
            <h2 className="mt-2 text-xl font-semibold text-[#03182F]">{metricSummaries[activeMetric].title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6B7480]">{metricSummaries[activeMetric].description}</p>
          </div>
          <p className="text-sm font-semibold text-[#03182F]">{metricEvents[activeMetric].length} événement{metricEvents[activeMetric].length > 1 ? 's' : ''}</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metricEvents[activeMetric].slice(0, 4).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelectedId(event.id)}
              className="rounded-xl border border-[#DDE5EE] bg-[#F2F8FF] p-3 text-left transition hover:border-rose-200 hover:bg-rose-50"
            >
              <p className="truncate text-sm font-semibold text-[#03182F]">{event.sku}</p>
              <p className="mt-1 truncate text-xs text-[#6B7480]">{event.productName}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#03182F]">{euro(event.estimatedLossValue)}</span>
                <span className="text-xs text-[#6B7480]">{event.quantityLost} u.</span>
              </div>
            </button>
          ))}
          {metricEvents[activeMetric].length === 0 && <p className="text-sm text-[#6B7480]">Aucun événement dans ce KPI.</p>}
        </div>
      </section>

      <section className="dashboard-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SKU, produit, commande..."
            className="rounded-xl border border-[#DDE5EE] bg-white px-3 py-2 text-sm outline-none ring-rose-500 transition focus:ring-2"
          />
          <select value={stage} onChange={(event) => setStage(event.target.value)} className="rounded-xl border border-[#DDE5EE] bg-white px-3 py-2 text-sm">
            <option value="all">Toutes les étapes</option>
            {stages.map((value) => (
              <option key={value} value={value}>
                {labelFromMap(stageLabels, value)}
              </option>
            ))}
          </select>
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-[#DDE5EE] bg-white px-3 py-2 text-sm">
            <option value="all">Toutes les raisons</option>
            {reasons.map((value) => (
              <option key={value} value={value}>
                {labelFromMap(reasonLabels, value)}
              </option>
            ))}
          </select>
          <select value={carrier} onChange={(event) => setCarrier(event.target.value)} className="rounded-xl border border-[#DDE5EE] bg-white px-3 py-2 text-sm">
            <option value="all">Tous transporteurs</option>
            {carriers.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select value={marketplace} onChange={(event) => setMarketplace(event.target.value)} className="rounded-xl border border-[#DDE5EE] bg-white px-3 py-2 text-sm">
            <option value="all">Toutes marketplaces</option>
            {marketplaces.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-[#DDE5EE] bg-white px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]?.label || value}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PieDistribution title="Où les pertes apparaissent ?" items={byStage} />
        <PieDistribution title="Pourquoi elles arrivent ?" items={byReason} />
        <PieDistribution title="Qui / quoi est concerné ?" items={byProduct} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="dashboard-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DDE5EE] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#03182F]">Événements de perte</h2>
              <p className="mt-1 text-sm text-[#6B7480]">{filteredEvents.length} ligne{filteredEvents.length > 1 ? 's' : ''} affichée{filteredEvents.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#F2F8FF] text-xs uppercase tracking-[0.14em] text-[#6B7480]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Détection</th>
                  <th className="px-5 py-3 font-semibold">Produit</th>
                  <th className="px-5 py-3 font-semibold">Perte</th>
                  <th className="px-5 py-3 font-semibold">Étape</th>
                  <th className="px-5 py-3 font-semibold">Raison</th>
                  <th className="px-5 py-3 font-semibold">Transport</th>
                  <th className="px-5 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => setSelectedId(event.id)}
                    className={`cursor-pointer transition hover:bg-rose-50/50 ${selectedEvent?.id === event.id ? 'bg-rose-50/70' : 'bg-white'}`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#03182F]">{dateFr(event.detectedAt)}</p>
                      <p className="mt-1 text-xs text-[#6B7480]">{event.sourceOrderRef}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#03182F]">{event.sku}</p>
                      <p className="mt-1 max-w-xs truncate text-xs text-[#6B7480]">{event.productName}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#03182F]">{euro(event.estimatedLossValue)}</p>
                      <p className="mt-1 text-xs text-[#6B7480]">{event.quantityLost} unité{event.quantityLost > 1 ? 's' : ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-[#30373E]">
                        <span className={`h-2 w-2 rounded-full ${stageAccent[event.detectedStage] || 'bg-[#F2F8FF]0'}`} />
                        {labelFromMap(stageLabels, event.detectedStage)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#30373E]">{labelFromMap(reasonLabels, event.reasonCategory)}</td>
                    <td className="px-5 py-4 text-[#30373E]">{event.carrierName || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusLabels[event.status]?.className || 'bg-slate-100 text-[#6B7480] ring-slate-200'}`}>
                        {statusLabels[event.status]?.label || event.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-[#6B7480]">
                      Aucune perte ne correspond aux filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="dashboard-card p-5">
          {selectedEvent ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7480]">Détail perte</p>
              <h2 className="mt-2 text-xl font-semibold text-[#03182F]">{selectedEvent.sku}</h2>
              <p className="mt-1 text-sm leading-6 text-[#6B7480]">{selectedEvent.productName}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#F2F8FF] p-3">
                  <p className="text-xs text-[#6B7480]">Valeur</p>
                  <p className="mt-1 font-semibold text-[#03182F]">{euro(selectedEvent.estimatedLossValue)}</p>
                </div>
                <div className="rounded-xl bg-[#F2F8FF] p-3">
                  <p className="text-xs text-[#6B7480]">Quantité</p>
                  <p className="mt-1 font-semibold text-[#03182F]">{selectedEvent.quantityLost}</p>
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                {[
                  ['Détecté le', dateFr(selectedEvent.detectedAt)],
                  ['Étape', labelFromMap(stageLabels, selectedEvent.detectedStage)],
                  ['Raison', labelFromMap(reasonLabels, selectedEvent.reasonCategory)],
                  ['Confiance', confidenceLabels[selectedEvent.confidence] || selectedEvent.confidence],
                  ['Statut', statusLabels[selectedEvent.status]?.label || selectedEvent.status],
                  ['Commande source', selectedEvent.sourceOrderRef || '—'],
                  ['Source', selectedEvent.sourceTable ? `${selectedEvent.sourceTable} ligne ${selectedEvent.sourceLine}` : '—'],
                  ['Marketplace', selectedEvent.marketplace || '—'],
                  ['Transporteur', selectedEvent.carrierName || '—'],
                  ['Catégorie', selectedEvent.category || '—'],
                  ['Prix catalogue', euro(selectedEvent.unitCost)],
                  ['Prix commande', euro(selectedEvent.orderUnitPrice)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-[#DDE5EE] pb-3">
                    <dt className="text-[#6B7480]">{label}</dt>
                    <dd className="text-right font-medium text-[#03182F]">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 rounded-xl bg-[#F2F8FF] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7480]">Contexte</p>
                <p className="mt-2 text-sm leading-6 text-[#30373E]">{selectedEvent.reasonDetail || selectedEvent.notes || 'Aucun détail.'}</p>
                {selectedEvent.notes && selectedEvent.reasonDetail && <p className="mt-3 text-xs leading-5 text-[#6B7480]">{selectedEvent.notes}</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B7480]">Sélectionnez une perte pour voir le détail.</p>
          )}
        </aside>
      </section>
    </div>
  )
}
