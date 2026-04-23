import assert from 'assert'
import { resolveDecisionMutation } from '../lib/mira/decisionMutations'

function fixedNow() {
  return new Date('2026-04-22T10:30:00.000Z')
}

function testApproveProposedDecision() {
  const mutation = resolveDecisionMutation({
    action: 'approve',
    currentStatus: 'proposed',
    now: fixedNow(),
  })

  assert.deepStrictEqual(mutation.decisionData, {
    status: 'auto_executed',
    executed_at: fixedNow(),
    founder_decision_at: fixedNow(),
  })
  assert.strictEqual(mutation.overrideRecord, null)
}

function testRejectQueuedDecisionRecordsPreviousStatus() {
  const mutation = resolveDecisionMutation({
    action: 'reject',
    currentStatus: 'queued',
    reason: 'Founder wants to review supplier lead time first',
    now: fixedNow(),
  })

  assert.deepStrictEqual(mutation.decisionData, {
    status: 'rejected',
    founder_decision_at: fixedNow(),
  })
  assert.deepStrictEqual(mutation.overrideRecord, {
    previous_status: 'queued',
    reason: 'Founder wants to review supplier lead time first',
  })
}

function testOverrideExecutedDecisionRecordsPreviousStatus() {
  const mutation = resolveDecisionMutation({
    action: 'override',
    currentStatus: 'auto_executed',
    reason: 'Supplier confirmed stock is unavailable',
    now: fixedNow(),
  })

  assert.deepStrictEqual(mutation.decisionData, {
    status: 'overridden',
    founder_decision_at: fixedNow(),
  })
  assert.deepStrictEqual(mutation.overrideRecord, {
    previous_status: 'auto_executed',
    reason: 'Supplier confirmed stock is unavailable',
  })
}

function testRejectExecutedDecisionIsInvalid() {
  assert.throws(
    () =>
      resolveDecisionMutation({
        action: 'reject',
        currentStatus: 'auto_executed',
        now: fixedNow(),
      }),
    /Use override for executed decisions/,
  )
}

function run() {
  testApproveProposedDecision()
  testRejectQueuedDecisionRecordsPreviousStatus()
  testOverrideExecutedDecisionRecordsPreviousStatus()
  testRejectExecutedDecisionIsInvalid()
  console.log('MIRA decision mutation tests OK')
}

run()
