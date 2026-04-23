// MIRA — FounderPolicy. Deterministic gate between an agent's proposal and the ledger.
// Inputs: autonomy mode (per action_type), founder state, action reversibility.
// Output: a final status that the caller writes to decision_ledger (or skips).

import { render, type TemplateId, type TemplateInputs } from './templates'

export type AutonomyMode = 'observe' | 'propose' | 'auto_execute'

export type FounderStateValue = 'Active' | 'Vacation' | 'Sick' | 'Busy'

export type ActionType =
  | 'pause_listing'
  | 'resume_listing'
  | 'propose_restock'
  | 'adjust_buffer'
  | 'flag_returns_pattern'
  | 'flag_reconciliation_variance'
  | 'calendar_buffer'

const REVERSIBLE_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  'pause_listing',
  'resume_listing',
  'adjust_buffer',
  'calendar_buffer',
])

export function isReversible(actionType: ActionType): boolean {
  return REVERSIBLE_ACTIONS.has(actionType)
}

// Founder availability widens safety buffers and lead times. Conservative by design.
export const AWAY_STATES: ReadonlySet<FounderStateValue> = new Set<FounderStateValue>(['Vacation', 'Sick'])
const BUFFER_MULTIPLIER_AWAY = 1.25
const LEAD_TIME_MULTIPLIER_AWAY = 1.4

export function safetyMultipliers(state: FounderStateValue) {
  if (AWAY_STATES.has(state)) {
    return { buffer: BUFFER_MULTIPLIER_AWAY, leadTime: LEAD_TIME_MULTIPLIER_AWAY }
  }
  return { buffer: 1, leadTime: 1 }
}

export type LedgerStatus = 'proposed' | 'auto_executed' | 'queued' | 'skipped'

export type PolicyDecision<K extends TemplateId> = {
  // 'skipped' means: do NOT write to the ledger (observe mode).
  status: LedgerStatus
  templateId: K | 'vacation_queue_v1'
  rendered: string
  reversible: boolean
  // Effective multipliers applied, for the agent to reuse when it sizes the action.
  multipliers: { buffer: number; leadTime: number }
}

export type PolicyInput<K extends TemplateId> = {
  actionType: ActionType
  autonomy: AutonomyMode
  founderState: FounderStateValue
  templateId: K
  templateInput: TemplateInputs[K]
  // Used when the founder is away and we must produce a vacation_queue_v1 trace.
  vacationQueue?: {
    return_date: string
    original_action: string
  }
}

export function evaluatePolicy<K extends TemplateId>(
  input: PolicyInput<K>,
): PolicyDecision<K> {
  const reversible = isReversible(input.actionType)
  const multipliers = safetyMultipliers(input.founderState)

  if (AWAY_STATES.has(input.founderState)) {
    const queue = input.vacationQueue ?? {
      return_date: 'à définir',
      original_action: input.actionType,
    }
    return {
      status: 'queued',
      templateId: 'vacation_queue_v1',
      rendered: render('vacation_queue_v1', queue),
      reversible,
      multipliers,
    }
  }

  if (input.autonomy === 'observe') {
    return {
      status: 'skipped',
      templateId: input.templateId,
      rendered: render(input.templateId, input.templateInput),
      reversible,
      multipliers,
    }
  }

  if (input.autonomy === 'auto_execute' && reversible) {
    return {
      status: 'auto_executed',
      templateId: input.templateId,
      rendered: render(input.templateId, input.templateInput),
      reversible,
      multipliers,
    }
  }

  return {
    status: 'proposed',
    templateId: input.templateId,
    rendered: render(input.templateId, input.templateInput),
    reversible,
    multipliers,
  }
}
