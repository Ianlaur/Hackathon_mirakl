import { normalizeAutonomyMode, type AutonomyPolicyMode } from '@/lib/leia/policy'

export const DEFAULT_AUTONOMY_ACTION_TYPES = [
  'pause_listing',
  'resume_listing',
  'restock',
  'adjust_buffer',
  'reputation_shield',
  'carrier_audit',
  'supplier_scorecard',
  'supplier_loss',
] as const

export type AutonomyActionType = (typeof DEFAULT_AUTONOMY_ACTION_TYPES)[number]

export type AutonomyConfigRow = {
  action_type: string
  mode: string
}

export type AutonomySnapshotItem = {
  action_type: string
  mode: AutonomyPolicyMode
  label: 'Watching' | 'Ask me' | 'Handle it'
}

function labelForMode(mode: AutonomyPolicyMode): AutonomySnapshotItem['label'] {
  if (mode === 'observe') return 'Watching'
  if (mode === 'auto_execute') return 'Handle it'
  return 'Ask me'
}

export function buildAutonomySnapshot(rows: AutonomyConfigRow[]) {
  const byAction = new Map(rows.map((row) => [row.action_type, normalizeAutonomyMode(row.mode)]))

  return {
    items: DEFAULT_AUTONOMY_ACTION_TYPES.map((actionType) => {
      const mode = byAction.get(actionType) ?? 'propose'
      return {
        action_type: actionType,
        mode,
        label: labelForMode(mode),
      }
    }),
  }
}

export function buildPauseEverythingConfig() {
  return DEFAULT_AUTONOMY_ACTION_TYPES.map((actionType) => ({
    action_type: actionType,
    mode: 'observe' as const,
  }))
}
