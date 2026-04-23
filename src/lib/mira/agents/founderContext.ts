// FounderContextAgent — reads founder_state + autonomy_config and returns the governance
// context that callers (tools_action, agents) feed into FounderPolicy.

import type { PrismaClient } from '@prisma/client'
import { AWAY_STATES, type AutonomyMode, type FounderStateValue } from '../policy'

export type Governance = {
  founderState: FounderStateValue
  founderUntil: Date | null
  autonomyByAction: Map<string, AutonomyMode>
  multipliers: { buffer: number; leadTime: number }
}

export async function loadGovernance(
  prisma: PrismaClient,
  userId: string,
): Promise<Governance> {
  const [founder, configs] = await Promise.all([
    prisma.founderState.findUnique({ where: { user_id: userId } }),
    prisma.autonomyConfig.findMany({ where: { user_id: userId } }),
  ])

  const founderState = (founder?.state as FounderStateValue) ?? 'Active'
  const autonomyByAction = new Map<string, AutonomyMode>(
    configs.map((c) => [c.action_type, c.mode as AutonomyMode]),
  )
  const multipliers = AWAY_STATES.has(founderState)
    ? { buffer: 1.25, leadTime: 1.4 }
    : { buffer: 1, leadTime: 1 }

  return {
    founderState,
    founderUntil: founder?.until ?? null,
    autonomyByAction,
    multipliers,
  }
}

export function resolveAutonomy(
  gov: Governance,
  actionType: string,
  fallback: AutonomyMode = 'propose',
): AutonomyMode {
  return gov.autonomyByAction.get(actionType) ?? fallback
}
