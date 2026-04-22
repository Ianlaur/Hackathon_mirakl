'use client'

import { useMemo, useState } from 'react'
import ActionCard from '@/components/copilot/ActionCard'
import type { ActionCardConfig, QuickActionId } from '@/types/copilot'

interface QuickActionsProps {
  stockAlertCount: number
}

const BASE_ACTIONS: ActionCardConfig[] = [
  {
    id: 'quoi_faire',
    label: 'Que faire maintenant ?',
    description: 'Obtenir une liste claire des priorites du jour.',
    cta: 'Voir mes priorites',
    icon: '✅',
    accentColor: '#8b5cf6',
    loadingLabel: 'Preparation de vos priorites...',
    highlight: true,
  },
  {
    id: 'resume_semaine',
    label: 'Resume de la semaine',
    description: "Voir ce qui s'est passe cette semaine.",
    cta: 'Voir le resume',
    icon: '📊',
    accentColor: '#3b82f6',
    loadingLabel: 'Analyse de votre semaine...',
  },
  {
    id: 'etat_stock',
    label: 'Etat de mon stock',
    description: 'Verifier les alertes et niveaux critiques.',
    cta: 'Checker les alertes',
    icon: '📦',
    accentColor: '#f59e0b',
    loadingLabel: 'Verification des niveaux...',
  },
  {
    id: 'statut_commandes',
    label: 'Statut des commandes',
    description: 'Voir les expeditions en cours et les retards.',
    cta: 'Voir les expeditions',
    icon: '🚛',
    accentColor: '#10b981',
    loadingLabel: 'Recuperation des expeditions...',
  },
]

export default function QuickActions({ stockAlertCount }: QuickActionsProps) {
  const [openCardId, setOpenCardId] = useState<QuickActionId | null>('quoi_faire')

  const actions = useMemo(
    () =>
      BASE_ACTIONS.map((action) =>
        action.id === 'etat_stock'
          ? {
              ...action,
              badgeCount: stockAlertCount,
            }
          : action
      ),
    [stockAlertCount]
  )

  async function triggerAction(actionId: QuickActionId) {
    const response = await fetch('/api/dust/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actionId }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Action failed')
    }

    return typeof payload?.result === 'string' ? payload.result : ''
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Actions rapides</h2>
        <p className="mt-1 text-sm text-slate-600">Clique sur une action pour obtenir une reponse directe.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
        {actions.map((action) => (
          <div key={action.id} className={action.highlight ? 'md:col-span-2' : ''}>
            <ActionCard
              {...action}
              isExpanded={openCardId === action.id}
              onExpand={() => setOpenCardId(action.id)}
              onCollapse={() => setOpenCardId((current) => (current === action.id ? null : current))}
              onTrigger={() => triggerAction(action.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
