export type DecisionMutationAction = 'approve' | 'reject' | 'override'

type DecisionMutationInput = {
  action: DecisionMutationAction
  currentStatus: string
  reason?: string
  now?: Date
}

type DecisionMutation = {
  decisionData: {
    status: string
    executed_at?: Date
    founder_decision_at: Date
  }
  overrideRecord: {
    previous_status: string
    reason: string | null
  } | null
}

function assertAllowed(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function resolveDecisionMutation(input: DecisionMutationInput): DecisionMutation {
  const now = input.now ?? new Date()
  const reason = input.reason?.trim() || null

  if (input.action === 'approve') {
    assertAllowed(
      input.currentStatus === 'proposed' || input.currentStatus === 'queued',
      'Only proposed or queued decisions can be approved.',
    )

    return {
      decisionData: {
        status: 'auto_executed',
        executed_at: now,
        founder_decision_at: now,
      },
      overrideRecord: null,
    }
  }

  if (input.action === 'reject') {
    assertAllowed(
      input.currentStatus === 'proposed' || input.currentStatus === 'queued',
      'Use override for executed decisions; only proposed or queued decisions can be rejected.',
    )

    return {
      decisionData: {
        status: 'rejected',
        founder_decision_at: now,
      },
      overrideRecord: {
        previous_status: input.currentStatus,
        reason,
      },
    }
  }

  assertAllowed(
    input.currentStatus === 'auto_executed',
    'Only executed decisions can be overridden.',
  )

  return {
    decisionData: {
      status: 'overridden',
      founder_decision_at: now,
    },
    overrideRecord: {
      previous_status: input.currentStatus,
      reason,
    },
  }
}
