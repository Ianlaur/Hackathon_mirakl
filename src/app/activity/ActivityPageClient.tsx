'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'

export type LedgerRow = {
  id: string
  sku: string | null
  channel: string | null
  action_type: string | null
  template_id: string | null
  logical_inference: string | null
  status: string
  reversible: boolean
  source_agent: string | null
  triggered_by: string | null
  trigger_event_id: string | null
  created_at: string
  executed_at: string | null
  founder_decision_at: string | null
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  proposed: { label: 'À valider', className: 'bg-[#FFF3CD] text-[#856404]' },
  queued: { label: 'En file', className: 'bg-[#E9F0FF] text-[#2764FF]' },
  auto_executed: { label: 'Exécutée', className: 'bg-[#3FA46A]/10 text-[#3FA46A]' },
  approved: { label: 'Approuvée', className: 'bg-[#3FA46A]/10 text-[#3FA46A]' },
  overridden: { label: 'Annulée', className: 'bg-[#FFE7EC] text-[#F22E75]' },
  rejected: { label: 'Rejetée', className: 'bg-[#DDE5EE] text-[#6B7480]' },
  skipped: { label: 'Ignorée', className: 'bg-[#DDE5EE] text-[#6B7480]' },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'proposed', label: 'Proposed' },
  { key: 'queued', label: 'Queued' },
  { key: 'auto_executed', label: 'Auto-executed' },
  { key: 'overridden', label: 'Overridden' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function ActivityPageClient({ initial }: { initial: LedgerRow[] }) {
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (!q) return true
      return (
        r.sku?.toLowerCase().includes(q) ||
        r.channel?.toLowerCase().includes(q) ||
        r.template_id?.toLowerCase().includes(q) ||
        r.action_type?.toLowerCase().includes(q) ||
        r.logical_inference?.toLowerCase().includes(q)
      )
    })
  }, [rows, filter, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/mira/ledger?limit=200', { cache: 'no-store' })
      if (resp.ok) {
        const data = await resp.json()
        if (Array.isArray(data?.decisions)) setRows(data.decisions as LedgerRow[])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Activity</h1>
          <p className="font-serif text-[13px] text-[#6B7480] mt-1">
            Audit trail of every MIRA decision. Immutable, template-only, fully reproducible.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex h-9 items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 font-serif text-[13px] font-bold text-[#30373E] transition-colors hover:bg-[#F2F8FF]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#DDE5EE] bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7480]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKU, channel, template…"
            className="h-10 w-full rounded border border-[#DDE5EE] bg-white pl-9 pr-3 font-serif text-[13px] text-[#03182F] outline-none focus:border-[#2764FF] focus:ring-1 focus:ring-[#2764FF]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key
            const n = counts[f.key] ?? 0
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 font-serif text-[12px] font-bold transition-colors ${
                  active
                    ? 'bg-[#2764FF] text-white'
                    : 'border border-[#DDE5EE] bg-white text-[#30373E] hover:bg-[#F2F8FF]'
                }`}
              >
                {f.label} ({n})
              </button>
            )
          })}
        </div>
      </div>

      {/* Ledger */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#BFCBDA] bg-white p-10 text-center font-serif text-sm text-[#6B7480]">
          Aucune décision ne correspond à ce filtre.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#DDE5EE] bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F2F8FF]">
                {['When', 'Template', 'SKU', 'Channel', 'Agent', 'Trigger', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5EE]">
              {filtered.map((r) => {
                const sMeta = STATUS_META[r.status] ?? {
                  label: r.status,
                  className: 'bg-[#DDE5EE] text-[#6B7480]',
                }
                return (
                  <tr key={r.id} className="hover:bg-[#F2F8FF]/40">
                    <td className="px-4 py-3 font-mono text-[11px] text-[#6B7480] whitespace-nowrap">
                      {formatTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-serif text-[13px] text-[#03182F]">
                      <div className="font-semibold">
                        {r.template_id ? r.template_id.replace(/_v\d+$/, '') : '—'}
                      </div>
                      {r.logical_inference ? (
                        <div className="mt-0.5 max-w-[420px] truncate text-[12px] text-[#6B7480]">
                          {r.logical_inference.split('\n')[0]}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#03182F]">{r.sku ?? '—'}</td>
                    <td className="px-4 py-3 font-serif text-[12px] text-[#30373E]">{r.channel ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#6B7480]">{r.source_agent ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#6B7480]">
                      <div>{r.triggered_by ?? '—'}</div>
                      {r.trigger_event_id ? (
                        <div className="mt-0.5 text-[10px] text-[#BFCBDA]">{r.trigger_event_id}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-serif text-[11px] font-bold ${sMeta.className}`}
                      >
                        {sMeta.label}
                      </span>
                      {!r.reversible ? (
                        <span className="ml-2 rounded-full bg-[#FFE7EC] px-2 py-0.5 font-serif text-[10px] font-bold text-[#F22E75]">
                          IRREVERSIBLE
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
