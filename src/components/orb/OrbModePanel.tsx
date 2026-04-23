'use client'

// MIRA — Orb governance panel. The Orb is a CONTROL, not a mascot, not information.
// Flips per-action-type modes in <1s so the founder keeps visible oversight.
// UI shows plain-language labels; internal codes never appear.

import { useCallback, useEffect, useState } from 'react'

type ModeCode = 'observe' | 'propose' | 'auto_execute'

type AutonomyRow = {
  action_type: string
  mode: ModeCode
}

const MODE_LABEL: Record<ModeCode, string> = {
  observe: 'Watching',
  propose: 'Ask me',
  auto_execute: 'Handle it',
}

const MODE_HINT: Record<ModeCode, string> = {
  observe: 'Je regarde, je ne fais rien.',
  propose: 'Je prépare, tu valides.',
  auto_execute: "Je gère, je t'informe.",
}

const ACTION_LABEL: Record<string, string> = {
  pause_listing: 'Pauser un listing',
  resume_listing: 'Reprendre un listing',
  propose_restock: 'Proposer un réassort',
  adjust_buffer: 'Ajuster un buffer',
  flag_returns_pattern: 'Signaler un pattern de retours',
  flag_reconciliation_variance: 'Signaler un écart stock',
  calendar_buffer: 'Préparer un événement commercial',
}

export default function OrbModePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<AutonomyRow[]>([])
  const [founderState, setFounderState] = useState<string>('Active')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/mira/autonomy', { cache: 'no-store' })
      if (!resp.ok) return
      const data = (await resp.json()) as { rows: AutonomyRow[]; founder: { state: string } }
      setRows(data.rows)
      setFounderState(data.founder.state)
    } catch {
      /* offline fallback */
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const setMode = async (actionType: string, mode: ModeCode) => {
    setBusy(actionType)
    // Optimistic update — UI responds in <1s.
    setRows((prev) => prev.map((r) => (r.action_type === actionType ? { ...r, mode } : r)))
    try {
      await fetch('/api/mira/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: actionType, mode }),
      })
    } finally {
      setBusy(null)
    }
  }

  const pauseAll = async () => {
    setBusy('__all__')
    setRows((prev) => prev.map((r) => ({ ...r, mode: 'observe' as ModeCode })))
    try {
      await fetch('/api/mira/autonomy/pause-all', { method: 'POST' })
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end bg-black/20 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Contrôle MIRA"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mira-card mira-card--raised w-full max-w-md overflow-hidden"
      >
        <header className="flex items-start justify-between border-b border-[color:var(--mira-border)] px-5 py-4">
          <div>
            <div className="mira-label">Contrôle MIRA</div>
            <h2 className="mira-display text-[18px] font-bold">Qui fait quoi</h2>
            <p className="mt-1 text-xs text-slate-600">
              Tu règles pour chaque action si MIRA regarde, demande, ou gère toute seule.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mira-button px-3 py-1 text-xs"
            aria-label="Fermer"
          >
            Fermer
          </button>
        </header>

        <div className="flex items-center justify-between gap-4 border-b border-[color:var(--mira-border)] bg-[color:var(--mira-bg)] px-5 py-3">
          <div className="text-xs">
            <span className="mira-label">État fondateur</span>
            <span className="ml-2 font-semibold text-[color:var(--mira-ink)]">{founderState}</span>
          </div>
          <button
            onClick={pauseAll}
            disabled={busy === '__all__'}
            className="rounded-md border border-[color:var(--mira-pink)] bg-[color:var(--mira-pink-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--mira-pink)] transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === '__all__' ? 'Pause…' : 'Tout passer en veille'}
          </button>
        </div>

        <ul className="max-h-[70vh] overflow-y-auto px-3 py-2">
          {rows.length === 0 ? (
            <li className="px-2 py-4 text-xs text-slate-500">Chargement…</li>
          ) : (
            rows.map((row) => (
              <li key={row.action_type} className="px-2 py-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[color:var(--mira-ink)]">
                    {ACTION_LABEL[row.action_type] ?? row.action_type}
                  </span>
                  <span className="text-[11px] text-slate-500">{MODE_HINT[row.mode]}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-[color:var(--mira-bg)] p-1">
                  {(['observe', 'propose', 'auto_execute'] as ModeCode[]).map((mode) => {
                    const active = row.mode === mode
                    return (
                      <button
                        key={mode}
                        onClick={() => setMode(row.action_type, mode)}
                        disabled={busy === row.action_type}
                        className={
                          'rounded-md px-2 py-1.5 text-xs font-semibold transition ' +
                          (active
                            ? 'bg-white text-[color:var(--mira-blue)] shadow-sm'
                            : 'text-slate-600 hover:text-[color:var(--mira-ink)]')
                        }
                      >
                        {MODE_LABEL[mode]}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
