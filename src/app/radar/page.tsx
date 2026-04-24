'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ClipboardPlus, Loader2, Send, X } from 'lucide-react'

type SupplierScorecard = {
  supplier_name: string
  total_losses_90d: number
  total_orders_90d: number
  loss_rate_pct: number
  estimated_recovery_potential_eur: number
  recovery_status: string
}

type RadarSnapshot = {
  profit_recovery: {
    carrier_audit_savings_eur: number
    supplier_recovery_potential_eur: number
    total_eur: number
  }
  carrier_audits: Array<{
    sku: string
    carrier: string
    damage_rate_pct: number
    estimated_savings_eur: number
    simulated: boolean
  }>
  supplier_scorecards: SupplierScorecard[]
}

const LOSS_TYPES = [
  { value: 'delivery_short', label: 'Delivery short' },
  { value: 'defective_batch', label: 'Defective batch' },
  { value: 'late_delivery', label: 'Late delivery' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'damaged_in_transit', label: 'Damaged in transit' },
]

const emptySnapshot: RadarSnapshot = {
  profit_recovery: {
    carrier_audit_savings_eur: 0,
    supplier_recovery_potential_eur: 0,
    total_eur: 0,
  },
  carrier_audits: [],
  supplier_scorecards: [],
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function RadarPage() {
  const [snapshot, setSnapshot] = useState<RadarSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    supplier_name: '',
    sku: '',
    loss_type: 'delivery_short',
    quantity: '1',
    notes: '',
  })

  const topSupplier = useMemo(
    () => snapshot.supplier_scorecards[0]?.supplier_name ?? 'No supplier flagged',
    [snapshot.supplier_scorecards]
  )

  async function loadRadar() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/radar', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Unable to load Radar.')
      setSnapshot(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Radar.')
      setSnapshot(emptySnapshot)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRadar()
  }, [])

  async function submitLoss(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/radar/supplier-losses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: form.supplier_name,
          sku: form.sku,
          loss_type: form.loss_type,
          quantity: Number(form.quantity),
          notes: form.notes || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Unable to declare supplier loss.')
      }

      setModalOpen(false)
      setForm({
        supplier_name: '',
        sku: '',
        loss_type: 'delivery_short',
        quantity: '1',
        notes: '',
      })
      await loadRadar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to declare supplier loss.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7480]">
            LEIA / Losses Radar
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#03182F]">
            Losses Radar
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2764FF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004bd9] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
        >
          <ClipboardPlus className="h-4 w-4" />
          Declare loss
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7480]">
            Profit Recovery
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#03182F]">
            {money(snapshot.profit_recovery.total_eur)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7480]">
            Supplier Potential
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#03182F]">
            {money(snapshot.profit_recovery.supplier_recovery_potential_eur)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7480]">
            Watch Supplier
          </p>
          <p className="mt-3 text-2xl font-semibold text-[#03182F]">{topSupplier}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-[#03182F]">Supplier scorecard</h2>
            <p className="mt-1 text-sm text-[#6B7480]">Losses and recovery potential over 90 days.</p>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-[#2764FF]" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-[#6B7480]">
              <tr>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Losses 90d</th>
                <th className="px-5 py-3">Loss rate</th>
                <th className="px-5 py-3">Recovery potential</th>
                <th className="px-5 py-3">Recovery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {snapshot.supplier_scorecards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#6B7480]">
                    No supplier losses declared.
                  </td>
                </tr>
              ) : (
                snapshot.supplier_scorecards.map((supplier) => (
                  <tr key={supplier.supplier_name} className="text-sm text-[#30373E]">
                    <td className="px-5 py-4 font-semibold text-[#03182F]">{supplier.supplier_name}</td>
                    <td className="px-5 py-4">{supplier.total_losses_90d}</td>
                    <td className="px-5 py-4">{supplier.loss_rate_pct}%</td>
                    <td className="px-5 py-4 font-semibold text-[#03182F]">
                      {money(supplier.estimated_recovery_potential_eur)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-blue-100 bg-[#2764FF]/10 px-2.5 py-1 text-xs font-semibold text-[#004bd9]">
                        {supplier.recovery_status.replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[#F22E75]" />
          <h2 className="text-lg font-semibold text-[#03182F]">Carrier audit</h2>
        </div>
        <p className="mt-3 text-sm text-[#6B7480]">
          Carrier savings feed stays at {money(snapshot.profit_recovery.carrier_audit_savings_eur)} until real
          damage-return rows are available.
        </p>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03182F]/40 p-4">
          <form
            onSubmit={submitLoss}
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#03182F]">Declare supplier loss</h2>
                <p className="mt-1 text-sm text-[#6B7480]">Logged through the same Leia action tool.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-2 text-[#6B7480] hover:bg-slate-100 hover:text-[#03182F]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#30373E]">
                Supplier
                <input
                  required
                  value={form.supplier_name}
                  onChange={(event) => setForm((current) => ({ ...current, supplier_name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2764FF] focus:ring-2 focus:ring-[#2764FF]/20"
                />
              </label>
              <label className="text-sm font-medium text-[#30373E]">
                SKU
                <input
                  required
                  value={form.sku}
                  onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2764FF] focus:ring-2 focus:ring-[#2764FF]/20"
                />
              </label>
              <label className="text-sm font-medium text-[#30373E]">
                Loss type
                <select
                  required
                  value={form.loss_type}
                  onChange={(event) => setForm((current) => ({ ...current, loss_type: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2764FF] focus:ring-2 focus:ring-[#2764FF]/20"
                >
                  {LOSS_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-[#30373E]">
                Quantity
                <input
                  required
                  min="1"
                  type="number"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2764FF] focus:ring-2 focus:ring-[#2764FF]/20"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-medium text-[#30373E]">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2764FF] focus:ring-2 focus:ring-[#2764FF]/20"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#30373E] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2764FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004bd9] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
