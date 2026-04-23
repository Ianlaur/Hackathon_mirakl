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

const reasonLabels: Record<string, string> = {
  damaged: 'Warehouse Disc.',
  lost_in_transit: 'Carrier Lost',
  inventory_mismatch: 'Inventory Gap',
  picking_error: 'Picking Error',
  supplier_shortage: 'Supplier Short',
  return_unsellable: 'Return Unsell.',
  theft_suspected: 'Theft Susp.',
  manual_adjustment: 'Manual Adj.',
}

const reasonStyle: Record<string, string> = {
  damaged: 'text-[#F22E75] bg-[#F22E75]/5 border-[#F22E75]/10',
  lost_in_transit: 'text-[#E0A93A] bg-[#E0A93A]/5 border-[#E0A93A]/10',
  inventory_mismatch: 'text-[#2764FF] bg-[#2764FF]/5 border-[#2764FF]/10',
  picking_error: 'text-[#2764FF] bg-[#2764FF]/5 border-[#2764FF]/10',
  supplier_shortage: 'text-[#6B7480] bg-[#F2F8FF] border-[#DDE5EE]',
  return_unsellable: 'text-[#F22E75] bg-[#F22E75]/5 border-[#F22E75]/10',
  theft_suspected: 'text-[#F22E75] bg-[#FFE7EC] border-[#F22E75]/10',
  manual_adjustment: 'text-[#6B7480] bg-[#F2F8FF] border-[#DDE5EE]',
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function LossesPageClient({ initialEvents, loadError }: Props) {
  const events = initialEvents
  const [hoveredMarketplaceIndex, setHoveredMarketplaceIndex] = useState<number | null>(null)
  const [livePulseCollapsed, setLivePulseCollapsed] = useState(false)

  const totalLostValue = useMemo(() => events.reduce((s, e) => s + e.estimatedLossValue, 0), [events])
  const totalLostUnits = useMemo(() => events.reduce((s, e) => s + e.quantityLost, 0), [events])
  const pendingClaims = useMemo(() => events.filter((e) => e.status === 'open' || e.status === 'investigating').length, [events])
  const resolvedCount = useMemo(() => events.filter((e) => e.status === 'resolved').length, [events])
  const reimbursementRate = events.length > 0 ? Math.round((resolvedCount / events.length) * 100) : 0

  const carrierGroups = useMemo(() => {
    const map = new Map<string, number>()
    events.forEach((e) => { const c = e.carrierName || 'Unknown'; map.set(c, (map.get(c) || 0) + e.estimatedLossValue) })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [events])
  const maxCarrierValue = carrierGroups.length > 0 ? carrierGroups[0][1] : 1

  const marketplaceGroups = useMemo(() => {
    const map = new Map<string, number>()
    events.forEach((e) => { const m = e.marketplace || 'Other'; map.set(m, (map.get(m) || 0) + e.estimatedLossValue) })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [events])
  const mpTotal = marketplaceGroups.reduce((s, [, v]) => s + v, 0) || 1
  const activeMarketplaceIndex =
    hoveredMarketplaceIndex !== null && marketplaceGroups[hoveredMarketplaceIndex]
      ? hoveredMarketplaceIndex
      : 0
  const activeMarketplace = marketplaceGroups[activeMarketplaceIndex]

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; units: number; value: number; reason: string }>()
    events.forEach((e) => {
      const existing = map.get(e.sku) || { name: e.productName, units: 0, value: 0, reason: e.reasonCategory }
      existing.units += e.quantityLost
      existing.value += e.estimatedLossValue
      map.set(e.sku, existing)
    })
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 5)
  }, [events])

  const recentEvents = useMemo(() => events.slice(0, 4), [events])

  const mpColors = ['#b6c4ff', '#2764FF', '#F22E75', '#03182F']

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Loss & Inventory Recovery</h1>
        <div className="bg-[#FFE7EC] border border-[#F22E75]/20 rounded-lg p-6 text-[#F22E75] font-serif">{loadError}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Loss & Inventory Recovery</h1>
        <p className="font-serif text-[14px] text-[#6B7480] mt-1 italic">Reporting period: Last 30 Days (Real-time stream)</p>
      </div>

      {/* Section 1: KPIs */}
      <div className="space-y-4">
        <h2 className="font-serif text-[30px] leading-tight font-bold text-[#03182F] sm:text-2xl">How are we recovering losses?</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="min-h-[140px] bg-white border border-[#DDE5EE] p-5 rounded-lg flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Total Lost Value</span>
              <span className="text-[#F22E75] font-serif text-[10px]">+12.4%</span>
            </div>
            <span className="font-serif text-[34px] sm:text-[44px] font-bold leading-none tracking-tight text-[#03182F] break-words">{fmt(totalLostValue)}</span>
          </div>
          <div className="min-h-[140px] bg-white border border-[#DDE5EE] p-5 rounded-lg flex flex-col justify-between">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Total Lost Units</span>
            <div>
              <span className="font-serif text-[34px] sm:text-[44px] font-bold leading-none tracking-tight text-[#03182F]">{totalLostUnits}</span>
              <p className="font-serif text-[12px] text-[#6B7480] mt-1 italic">Across {new Set(events.map((e) => e.carrierName).filter(Boolean)).size} carriers</p>
            </div>
          </div>
          <div className="min-h-[140px] bg-white border border-[#DDE5EE] p-5 rounded-lg flex flex-col justify-between">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Claims Pending</span>
            <div>
              <span className="font-serif text-[34px] sm:text-[44px] font-bold leading-none tracking-tight text-[#03182F]">{pendingClaims}</span>
              <p className="font-serif text-[12px] text-[#E0A93A] mt-1 font-bold">Action required on {events.filter((e) => e.status === 'open').length}</p>
            </div>
          </div>
          <div className="min-h-[140px] bg-white border border-[#DDE5EE] p-5 rounded-lg flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Reimbursement Rate</span>
              <span className="text-[#3FA46A] font-serif text-[10px]">94% Target</span>
            </div>
            <div>
              <span className="font-serif text-[34px] sm:text-[44px] font-bold leading-none tracking-tight text-[#03182F]">{reimbursementRate}%</span>
              <div className="mt-3 w-full bg-[#ededfa] h-1 rounded-full overflow-hidden">
                <div className="bg-[#2764FF] h-full" style={{ width: `${reimbursementRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Charts */}
      <div className="space-y-4">
        <h2 className="font-serif text-[30px] leading-tight font-bold text-[#03182F] sm:text-2xl">Why are these losses happening?</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Bar chart */}
          <div className="xl:col-span-2 bg-white border border-[#DDE5EE] p-4 sm:p-6 rounded-lg">
            <h3 className="font-serif text-base font-bold text-[#03182F] mb-6">Loss by Carrier (Monthly Euro Impact)</h3>
            <div className="overflow-x-auto">
              <div className="flex min-w-[560px] items-end justify-between h-[240px] px-4 gap-8">
                {carrierGroups.map(([name, value], i) => (
                  <div key={name} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t-sm relative group ${i === 0 ? 'bg-[#FFE7EC] border border-[#F22E75]/20' : 'bg-[#2764FF]/10 border border-[#2764FF]/20'}`}
                      style={{ height: `${(value / maxCarrierValue) * 100}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-serif text-[10px] text-[#03182F] opacity-0 group-hover:opacity-100 transition-opacity">
                        {fmt(value)}
                      </div>
                    </div>
                    <span className="mt-4 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase text-center break-words">{name || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut chart */}
          <div className="bg-white border border-[#DDE5EE] p-4 sm:p-6 rounded-lg">
            <h3 className="font-serif text-base font-bold text-[#03182F] mb-6">Loss by Platform</h3>
            <div className="flex flex-col items-center justify-center h-[240px]">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {marketplaceGroups.map(([, value], i) => {
                    const pct = (value / mpTotal) * 100
                    const offset = marketplaceGroups.slice(0, i).reduce((s, [, v]) => s + (v / mpTotal) * 100, 0)
                    const isActive = i === activeMarketplaceIndex
                    return (
                      <circle
                        key={i}
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke={mpColors[i % mpColors.length]}
                        strokeWidth={isActive ? '5.2' : '4'}
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={`${-offset}`}
                        className="cursor-pointer transition-all duration-150"
                        style={{ opacity: isActive ? 1 : 0.55 }}
                        onMouseEnter={() => setHoveredMarketplaceIndex(i)}
                        onMouseLeave={() => setHoveredMarketplaceIndex(null)}
                        onFocus={() => setHoveredMarketplaceIndex(i)}
                        onBlur={() => setHoveredMarketplaceIndex(null)}
                      />
                    )
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-serif text-[10px] text-[#6B7480]">
                    {hoveredMarketplaceIndex !== null ? 'PREVIEW' : 'DOMINANT'}
                  </span>
                  <span className="font-serif font-bold text-[#03182F] text-center px-2">
                    {activeMarketplace?.[0] || 'N/A'}
                  </span>
                  {activeMarketplace ? (
                    <span className="mt-1 font-serif text-[10px] text-[#6B7480]">
                      {Math.round((activeMarketplace[1] / mpTotal) * 100)}% · {fmt(activeMarketplace[1])}
                    </span>
                  ) : null}
                </div>
              </div>
              {activeMarketplace ? (
                <p className="mt-3 rounded border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-1.5 font-serif text-[12px] text-[#30373E]">
                  {activeMarketplace[0]}: {fmt(activeMarketplace[1])} ({Math.round((activeMarketplace[1] / mpTotal) * 100)}%)
                </p>
              ) : null}
              <div className="mt-6 grid w-full grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-4">
                {marketplaceGroups.map(([name, value], i) => (
                  <div
                    key={name}
                    className={`flex items-center gap-2 min-w-0 rounded px-1.5 py-1 cursor-pointer transition-colors ${
                      i === activeMarketplaceIndex ? 'bg-[#F2F8FF]' : 'hover:bg-[#F2F8FF]/70'
                    }`}
                    onMouseEnter={() => setHoveredMarketplaceIndex(i)}
                    onMouseLeave={() => setHoveredMarketplaceIndex(null)}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mpColors[i % mpColors.length] }} />
                    <span className="font-serif text-[12px] text-[#30373E] break-words">{name} {Math.round((value / mpTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Product table + Live pulse */}
      <div className="space-y-4">
        <h2 className="font-serif text-[30px] leading-tight font-bold text-[#03182F] sm:text-2xl">What products are affected?</h2>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Table */}
          <div className="xl:col-span-3 bg-white border border-[#DDE5EE] rounded-lg overflow-hidden">
            <div className="p-6 border-b border-[#DDE5EE] flex justify-between items-center">
              <h3 className="font-serif text-base font-bold text-[#03182F]">Top Product-Level Losses</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="bg-[#f3f2ff] border-b border-[#DDE5EE]">
                    <th className="w-[48%] py-4 px-6 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Product Details</th>
                    <th className="w-[10%] py-4 px-6 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase whitespace-nowrap">Units Lost</th>
                    <th className="w-[14%] py-4 px-6 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase whitespace-nowrap">Financial Impact</th>
                    <th className="w-[16%] py-4 px-6 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase whitespace-nowrap">Main Cause</th>
                    <th className="w-[12%] py-4 px-6 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5EE]">
                  {topProducts.map(([sku, p]) => (
                    <tr key={sku} className="hover:bg-[#F2F8FF] transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded border border-[#DDE5EE] bg-[#F2F8FF] flex items-center justify-center font-serif text-[10px] text-[#6B7480]">{sku.slice(0, 4)}</div>
                          <span className="font-serif text-[14px] text-[#03182F] font-bold break-words">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-serif text-[14px] whitespace-nowrap">{p.units}</td>
                      <td className="py-4 px-6 font-serif text-[14px] text-[#F22E75] whitespace-nowrap">{fmt(p.value)}</td>
                      <td className="py-4 px-6 min-w-[160px]">
                        <span className={`inline-flex items-center whitespace-nowrap font-serif text-[12px] border px-2 py-1 rounded-full ${reasonStyle[p.reason] || 'text-[#6B7480] bg-[#F2F8FF] border-[#DDE5EE]'}`}>
                          {reasonLabels[p.reason] || p.reason}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <button className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#2764FF] hover:underline uppercase whitespace-nowrap">Investigate</button>
                      </td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && (
                    <tr><td colSpan={5} className="py-8 px-6 text-center font-serif text-[#6B7480]">No loss data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Pulse */}
          <div className="bg-white border border-[#DDE5EE] rounded-lg flex flex-col max-h-[600px]">
            <div className="p-6 border-b border-[#DDE5EE]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-bold text-[#03182F]">Live Pulse</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-[#3FA46A] rounded-full animate-pulse mr-2" />
                    <span className="font-serif text-[10px] uppercase text-[#3FA46A]">Streaming</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLivePulseCollapsed((value) => !value)}
                    className="rounded-md border border-[#DDE5EE] p-1 text-[#6B7480] hover:bg-[#F2F8FF] hover:text-[#03182F]"
                    aria-label={livePulseCollapsed ? 'Expand Live Pulse' : 'Collapse Live Pulse'}
                    title={livePulseCollapsed ? 'Expand Live Pulse' : 'Collapse Live Pulse'}
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${livePulseCollapsed ? '' : 'rotate-180'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {!livePulseCollapsed && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {recentEvents.map((e) => {
                  const borderColor = e.status === 'open' ? 'border-[#F22E75]' : e.status === 'resolved' ? 'border-[#2764FF]' : 'border-[#E0A93A]'
                  const tagColor = e.status === 'open' ? 'text-[#F22E75]' : e.status === 'resolved' ? 'text-[#2764FF]' : 'text-[#E0A93A]'
                  const tagLabel = e.status === 'open' ? 'URGENT' : e.status === 'resolved' ? 'RECOVERY' : 'CLAIM'
                  return (
                    <div key={e.id} className={`flex gap-4 border-l-2 ${borderColor} pl-4 py-1`}>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <span className="font-serif text-[10px] text-[#6B7480]">{new Date(e.detectedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          <span className={`font-serif text-[9px] font-bold ${tagColor}`}>{tagLabel}</span>
                        </div>
                        <p className="font-serif text-[13px] text-[#03182F] mt-1">{e.productName} — {reasonLabels[e.reasonCategory] || e.reasonCategory} ({e.quantityLost} units, {fmt(e.estimatedLossValue)})</p>
                      </div>
                    </div>
                  )
                })}
                {recentEvents.length === 0 && (
                  <p className="font-serif text-[13px] text-[#6B7480] text-center py-4">No recent events</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
        <div className="bg-[#FFE7EC] border border-[#F22E75]/20 p-6 rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#F22E75] mb-4">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] uppercase">High-Value Dispute Needed</span>
            </div>
            <h4 className="font-serif text-base font-bold text-[#03182F]">Top Loss Product Dispute</h4>
            <p className="font-serif text-[14px] text-[#30373E] mt-2">
              {topProducts[0] ? `${topProducts[0][1].name}: ${topProducts[0][1].units} units lost (${fmt(topProducts[0][1].value)}). Consider escalating for reimbursement.` : 'No high-value disputes at this time.'}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="h-9 px-6 bg-[#F22E75] text-white font-serif text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity">Escalate to Legal</button>
            <button className="h-9 px-6 border border-[#F22E75]/30 text-[#F22E75] font-serif text-[13px] font-bold rounded-lg hover:bg-white transition-colors">Review Evidence</button>
          </div>
        </div>
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#2764FF] mb-4">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] uppercase">Leia Recommendation</span>
            </div>
            <h4 className="font-serif text-base font-bold text-[#03182F]">Carrier Switch Suggestion</h4>
            <p className="font-serif text-[14px] text-[#30373E] mt-2">
              {carrierGroups[0] ? `${carrierGroups[0][0]} has the highest loss rate (${fmt(carrierGroups[0][1])}). Consider switching to an alternative carrier for affected routes.` : 'No carrier recommendations at this time.'}
            </p>
          </div>
          <div className="mt-6">
            <button className="h-9 px-6 bg-[#004bd9] text-white font-serif text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity">Apply Routing Rule</button>
          </div>
        </div>
      </div>
    </div>
  )
}
