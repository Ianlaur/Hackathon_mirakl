'use client'

import { useEffect, useState } from 'react'
import { Loader2, PauseCircle, ShieldAlert, ShieldCheck } from 'lucide-react'

const MODE_OPTIONS = [
  { mode: 'observe', label: 'Watching' },
  { mode: 'propose', label: 'Ask me' },
  { mode: 'auto_execute', label: 'Handle it' },
] as const

type AutonomyMode = (typeof MODE_OPTIONS)[number]['mode']

type AutonomyItem = {
  action_type: string
  mode: AutonomyMode
  label: string
}

type GovernanceSnapshot = {
  autonomy: {
    items: AutonomyItem[]
  }
  founder_context: {
    state: string
    until: string | null
    isAway: boolean
    queueAllDecisions: boolean
    bufferMultiplier: number
    leadTimeMultiplier: number
  }
  safety_fuse: {
    recent_trips_7d: number
    tripped: boolean
  }
}

export default function LeiaGovernancePanel() {
  const [governance, setGovernance] = useState<GovernanceSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGovernance = async () => {
    try {
      const resp = await fetch('/api/autonomy', { cache: 'no-store' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error ?? 'Failed to load governance')
      setGovernance(data as GovernanceSnapshot)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Governance is unavailable')
    }
  }

  useEffect(() => {
    loadGovernance()
  }, [])

  const updateMode = async (actionType: string, mode: AutonomyMode) => {
    setGovernance((current) =>
      current
        ? {
            ...current,
            autonomy: {
              items: current.autonomy.items.map((item) =>
                item.action_type === actionType
                  ? {
                      ...item,
                      mode,
                      label: MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? item.label,
                    }
                  : item
              ),
            },
          }
        : current
    )

    const resp = await fetch('/api/autonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: actionType, mode }),
    })
    if (!resp.ok) loadGovernance()
  }

  const pauseEverything = async () => {
    setGovernance((current) =>
      current
        ? {
            ...current,
            autonomy: {
              items: current.autonomy.items.map((item) => ({
                ...item,
                mode: 'observe',
                label: 'Watching',
              })),
            },
          }
        : current
    )

    const resp = await fetch('/api/autonomy/pause-all', { method: 'POST' })
    if (!resp.ok) loadGovernance()
  }

  const scanFuses = async () => {
    setBusy(true)
    try {
      await fetch('/api/autonomy/safety-fuse/scan', { method: 'POST' })
      await loadGovernance()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-[#F22E75]/25 bg-[#FFE7EC] px-4 py-3 font-serif text-[13px] text-[#03182F]">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-[#DDE5EE] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE5EE] bg-[#F2F8FF] px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2764FF]" />
            <p className="font-serif text-[15px] font-bold text-[#03182F]">Leia governance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={scanFuses}
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 text-[12px] font-bold text-[#30373E] hover:bg-[#F2F8FF] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              Scan fuses
            </button>
            <button
              type="button"
              onClick={pauseEverything}
              className="inline-flex h-9 items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 text-[12px] font-bold text-[#30373E] hover:bg-[#FFE7EC]"
            >
              <PauseCircle className="h-4 w-4" />
              Pause everything
            </button>
          </div>
        </header>

        <div className="grid gap-4 p-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-3">
            <div className="rounded-lg border border-[#DDE5EE] bg-[#F2F8FF]/70 px-4 py-3">
              <p className="font-serif text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7480]">
                Founder state
              </p>
              <p className="mt-1 font-serif text-[16px] font-bold text-[#03182F]">
                {governance?.founder_context.state ?? 'Loading'}
              </p>
              {governance?.founder_context.until ? (
                <p className="mt-1 font-mono text-[12px] text-[#30373E]">
                  Until {governance.founder_context.until.slice(0, 10)}
                </p>
              ) : null}
            </div>

            <div
              className={`rounded-lg border px-4 py-3 ${
                governance?.safety_fuse.tripped
                  ? 'border-[#F22E75]/25 bg-[#FFE7EC]'
                  : 'border-[#DDE5EE] bg-white'
              }`}
            >
              <p className="font-serif text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7480]">
                Safety fuse
              </p>
              <p className="mt-1 font-serif text-[16px] font-bold text-[#03182F]">
                {governance?.safety_fuse.recent_trips_7d ?? 0} trips in 7 days
              </p>
            </div>

            {governance?.founder_context.isAway ? (
              <div className="rounded-lg border border-[#F22E75]/25 bg-[#FFE7EC] px-4 py-3">
                <p className="font-serif text-[13px] font-bold text-[#03182F]">
                  Buffers x{governance.founder_context.bufferMultiplier}
                </p>
                <p className="mt-1 font-serif text-[13px] text-[#30373E]">
                  Lead times x{governance.founder_context.leadTimeMultiplier}.
                  {governance.founder_context.queueAllDecisions ? ' Decisions are queued.' : ''}
                </p>
              </div>
            ) : null}
          </aside>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(governance?.autonomy.items ?? []).map((item) => (
              <div key={item.action_type} className="rounded-lg border border-[#DDE5EE] bg-white p-3">
                <p className="mb-3 font-mono text-[12px] font-semibold text-[#03182F]">
                  {item.action_type}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {MODE_OPTIONS.map((option) => {
                    const active = item.mode === option.mode
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => updateMode(item.action_type, option.mode)}
                        className={`min-h-9 rounded border px-2 text-[12px] font-bold transition ${
                          active
                            ? 'border-[#2764FF] bg-[#2764FF] text-white'
                            : 'border-[#DDE5EE] bg-white text-[#30373E] hover:bg-[#F2F8FF]'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
