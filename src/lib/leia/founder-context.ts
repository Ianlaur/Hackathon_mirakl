import { prisma } from '@/lib/prisma'
import {
  normalizeFounderState,
  safetyMultipliersForFounderState,
  type FounderStateName,
} from '@/lib/leia/policy'
import { syncFounderStateFromCalendarForUser } from '@/lib/leia/calendar-sync'

export type FounderContext = {
  state: FounderStateName
  until: string | null
  isAway: boolean
  queueAllDecisions: boolean
  bufferMultiplier: number
  leadTimeMultiplier: number
}

export function buildFounderContext(input: {
  state?: string | null
  until?: Date | string | null
}): FounderContext {
  const state = normalizeFounderState(input.state)
  const multipliers = safetyMultipliersForFounderState(state)
  const isAway = state === 'Travelling' || state === 'Sick' || state === 'Vacation'

  return {
    state,
    until:
      input.until instanceof Date
        ? input.until.toISOString()
        : input.until
          ? String(input.until)
          : null,
    isAway,
    queueAllDecisions: state === 'Sick' || state === 'Vacation',
    bufferMultiplier: multipliers.bufferMultiplier,
    leadTimeMultiplier: multipliers.leadTimeMultiplier,
  }
}

export async function getFounderContextForUser(userId: string) {
  await syncFounderStateFromCalendarForUser(userId)

  const state = await prisma.founderState.findUnique({
    where: { user_id: userId },
    select: { state: true, until: true },
  })

  return buildFounderContext({
    state: state?.state ?? 'Available',
    until: state?.until ?? null,
  })
}
