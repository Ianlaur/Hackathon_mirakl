'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, Hand, Sparkles, PauseCircle } from 'lucide-react'
import LeiaIcon from '@/components/LeiaIcon'

// Internal code → founder-facing label per CLAUDE.md UX language rules.
const MODE_META: Record<string, { label: string; description: string; icon: typeof Eye; color: string }> = {
  observe: {
    label: 'Watching',
    description: 'Data logging only. MIRA ne touche à rien.',
    icon: Eye,
    color: 'text-[#6B7480]',
  },
  propose: {
    label: 'Ask me',
    description: 'MIRA prépare, je valide.',
    icon: Hand,
    color: 'text-[#2764FF]',
  },
  auto_execute: {
    label: 'Handle it',
    description: 'MIRA exécute si réversible, trace dans le ledger.',
    icon: Sparkles,
    color: 'text-[#3FA46A]',
  },
}

const ACTION_LABELS: Record<string, string> = {
  pause_listing: 'Pause listing',
  resume_listing: 'Resume listing',
  propose_restock: 'Restock proposal',
  adjust_buffer: 'Buffer adjustment',
  flag_returns_pattern: 'Returns pattern',
  flag_reconciliation_variance: 'Reconciliation variance',
  calendar_buffer: 'Calendar posture',
}

type AutonomyRow = { action_type: string; mode: string }

type AutonomyResponse = {
  action_types: string[]
  modes: string[]
  rows: AutonomyRow[]
  founder: { state: string; until: string | null }
}

export default function OrbModePanel() {
  const [data, setData] = useState<AutonomyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch('/api/mira/autonomy', { cache: 'no-store' })
      if (!resp.ok) throw new Error('Failed to load autonomy')
      const payload = (await resp.json()) as AutonomyResponse
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const changeMode = async (action_type: string, mode: string) => {
    setPendingAction(action_type)
    setError(null)
    try {
      const resp = await fetch('/api/mira/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type, mode }),
      })
      if (!resp.ok) throw new Error('Failed to update mode')
      // Optimistic update
      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) =>
                r.action_type === action_type ? { ...r, mode } : r,
              ),
            }
          : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPendingAction(null)
    }
  }

  const pauseAll = async () => {
    setPendingAction('__all__')
    setError(null)
    try {
      const resp = await fetch('/api/mira/autonomy/pause-all', { method: 'POST' })
      if (!resp.ok) throw new Error('Failed to pause')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPendingAction(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-[#DDE5EE] bg-white p-6 font-serif text-sm text-[#6B7480]">
        Loading governance…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-[#F22E75]/30 bg-[#FFE7EC] p-6 font-serif text-sm text-[#F22E75]">
        {error ?? 'Governance unavailable.'}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#DDE5EE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F8FF] text-[#2764FF]">
            <LeiaIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">
                Autonomy governance
              </span>
              <span className="rounded-full bg-[#E9F0FF] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#2764FF]">
                Founder state: {data.founder.state}
              </span>
            </div>
            <h3 className="mt-1 font-serif text-lg font-bold text-[#03182F]">Leia</h3>
            <p className="mt-1 font-serif text-[12px] text-[#6B7480]">
              Per action type, decide how much Leia can act on her own.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={pauseAll}
          disabled={pendingAction === '__all__'}
          className="inline-flex h-9 items-center gap-2 rounded border border-[#F22E75]/30 bg-[#FFE7EC] px-3 font-serif text-[12px] font-bold text-[#F22E75] transition-colors hover:bg-[#F22E75]/10 disabled:opacity-60"
        >
          <PauseCircle className="h-4 w-4" />
          Pause everything
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded bg-[#FFE7EC] px-3 py-2 font-serif text-[12px] text-[#F22E75]">{error}</p>
      ) : null}

      <ul className="divide-y divide-[#DDE5EE]">
        {data.rows.map((row) => {
          const pending = pendingAction === row.action_type
          return (
            <li key={row.action_type} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <p className="font-serif text-[13px] font-semibold text-[#03182F]">
                  {ACTION_LABELS[row.action_type] ?? row.action_type}
                </p>
              </div>
              <div className="flex gap-1 rounded-full border border-[#DDE5EE] bg-[#F2F8FF] p-1">
                {data.modes.map((m) => {
                  const meta = MODE_META[m]
                  if (!meta) return null
                  const Icon = meta.icon
                  const active = row.mode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={pending || active}
                      onClick={() => changeMode(row.action_type, m)}
                      title={meta.description}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-serif text-[11px] font-bold transition-colors ${
                        active
                          ? 'bg-[#03182F] text-white shadow-sm'
                          : 'text-[#30373E] hover:bg-white'
                      } disabled:opacity-70`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : meta.color}`} />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
