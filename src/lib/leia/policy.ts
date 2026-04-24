export type FounderStateName = 'Available' | 'Travelling' | 'OffHours' | 'Sick' | 'Vacation'

export type AutonomyPolicyMode = 'observe' | 'propose' | 'auto_execute'

export type FounderPolicyRoute = 'observe' | 'proposed' | 'queued' | 'auto_executed'

export type FounderPolicyResult = {
  route: FounderPolicyRoute
  status: 'observed' | 'proposed' | 'queued' | 'auto_executed'
  writeLedger: boolean
}

export function normalizeFounderState(value: string | null | undefined): FounderStateName {
  const normalized = String(value || '').trim().toLowerCase()

  if (normalized === 'travelling' || normalized === 'traveling') return 'Travelling'
  if (normalized === 'offhours' || normalized === 'off_hours' || normalized === 'off hours') {
    return 'OffHours'
  }
  if (normalized === 'sick') return 'Sick'
  if (normalized === 'vacation' || normalized === 'holiday' || normalized === 'leave') {
    return 'Vacation'
  }

  return 'Available'
}

export function normalizeAutonomyMode(value: string | null | undefined): AutonomyPolicyMode {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (normalized === 'watching' || normalized === 'watch' || normalized === 'observe') {
    return 'observe'
  }
  if (
    normalized === 'ask_me' ||
    normalized === 'ask' ||
    normalized === 'propose' ||
    normalized === 'approval_required'
  ) {
    return 'propose'
  }
  if (
    normalized === 'handle_it' ||
    normalized === 'handle' ||
    normalized === 'auto' ||
    normalized === 'auto_execute' ||
    normalized === 'autonomous'
  ) {
    return 'auto_execute'
  }

  return 'propose'
}

export function evaluateFounderPolicy(args: {
  autonomyMode: string | null | undefined
  founderState: string | null | undefined
  reversible: boolean
}): FounderPolicyResult {
  const mode = normalizeAutonomyMode(args.autonomyMode)
  const founderState = normalizeFounderState(args.founderState)

  if (mode === 'observe') {
    return { route: 'observe', status: 'observed', writeLedger: false }
  }

  if (founderState === 'Vacation' || founderState === 'Sick') {
    return { route: 'queued', status: 'queued', writeLedger: true }
  }

  if (mode === 'auto_execute' && args.reversible) {
    return { route: 'auto_executed', status: 'auto_executed', writeLedger: true }
  }

  return { route: 'proposed', status: 'proposed', writeLedger: true }
}

export function safetyMultipliersForFounderState(value: string | null | undefined) {
  const founderState = normalizeFounderState(value)
  const away = founderState === 'Travelling' || founderState === 'Sick' || founderState === 'Vacation'

  return {
    bufferMultiplier: away ? 1.25 : 1,
    leadTimeMultiplier: away ? 1.4 : 1,
  }
}
