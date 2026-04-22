'use client'

import { useState } from 'react'
import ResultPanel from '@/components/copilot/ResultPanel'
import type { ActionCardConfig, CardState } from '@/types/copilot'

interface ActionCardProps extends ActionCardConfig {
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onTrigger: () => Promise<string>
}

export default function ActionCard({
  label,
  description,
  cta,
  icon,
  accentColor,
  loadingLabel,
  highlight,
  badgeCount,
  isExpanded,
  onExpand,
  onCollapse,
  onTrigger,
}: ActionCardProps) {
  const [state, setState] = useState<CardState>('idle')
  const [result, setResult] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleRun() {
    onExpand()
    setState('loading')
    setErrorMessage('')

    try {
      const nextResult = await onTrigger()
      setResult(nextResult)
      setState('result')
    } catch {
      setState('error')
      setErrorMessage('Impossible de recuperer vos donnees, reessayez.')
    }
  }

  const hasResult = state === 'result' && Boolean(result)

  return (
    <article
      className={`rounded-2xl border bg-white p-5 transition-all duration-150 ${
        highlight ? 'shadow-sm ring-1 ring-violet-200' : 'shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
      }`}
      style={{ borderColor: 'rgba(15,23,42,0.1)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <h3 className="text-base font-medium text-slate-900">{label}</h3>
            {badgeCount && badgeCount > 0 ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {badgeCount}
              </span>
            ) : null}
          </div>

          <p className="text-[13px] text-slate-600">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void handleRun()
          }}
          disabled={state === 'loading'}
          className="text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: accentColor }}
        >
          {state === 'loading' ? loadingLabel : cta}
        </button>

        {hasResult && !isExpanded ? (
          <button
            type="button"
            onClick={onExpand}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            Voir
          </button>
        ) : null}

        {isExpanded ? (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            Fermer
          </button>
        ) : null}
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? 'mt-4 max-h-[1000px] border-t border-slate-100 pt-4 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {state === 'loading' ? <p className="text-sm text-slate-600">{loadingLabel}</p> : null}
        {state === 'error' ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        {state === 'result' ? (
          <div className="transition-opacity duration-200 ease-in opacity-100">
            <ResultPanel content={result} accentColor={accentColor} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
