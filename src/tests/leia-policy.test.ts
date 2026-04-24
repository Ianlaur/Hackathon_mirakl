import { describe, expect, it } from 'vitest'

import {
  evaluateFounderPolicy,
  normalizeAutonomyMode,
  safetyMultipliersForFounderState,
} from '@/lib/leia/policy'

describe('FounderPolicy', () => {
  it('maps watching mode to observe without a ledger write', () => {
    expect(
      evaluateFounderPolicy({
        autonomyMode: 'watching',
        founderState: 'Available',
        reversible: true,
      })
    ).toEqual({ route: 'observe', status: 'observed', writeLedger: false })
  })

  it('maps ask-me mode to proposed', () => {
    expect(
      evaluateFounderPolicy({
        autonomyMode: 'ask_me',
        founderState: 'Available',
        reversible: true,
      })
    ).toEqual({ route: 'proposed', status: 'proposed', writeLedger: true })
  })

  it('allows auto execution only when the action is reversible', () => {
    expect(
      evaluateFounderPolicy({
        autonomyMode: 'handle_it',
        founderState: 'Available',
        reversible: true,
      })
    ).toEqual({ route: 'auto_executed', status: 'auto_executed', writeLedger: true })

    expect(
      evaluateFounderPolicy({
        autonomyMode: 'handle_it',
        founderState: 'Available',
        reversible: false,
      })
    ).toEqual({ route: 'proposed', status: 'proposed', writeLedger: true })
  })

  it('queues every decision while founder is sick or on vacation', () => {
    expect(
      evaluateFounderPolicy({
        autonomyMode: 'handle_it',
        founderState: 'Vacation',
        reversible: true,
      })
    ).toEqual({ route: 'queued', status: 'queued', writeLedger: true })

    expect(
      evaluateFounderPolicy({
        autonomyMode: 'ask_me',
        founderState: 'Sick',
        reversible: false,
      })
    ).toEqual({ route: 'queued', status: 'queued', writeLedger: true })
  })

  it('normalizes UI autonomy labels to policy modes', () => {
    expect(normalizeAutonomyMode('Watching')).toBe('observe')
    expect(normalizeAutonomyMode('Ask me')).toBe('propose')
    expect(normalizeAutonomyMode('Handle it')).toBe('auto_execute')
  })

  it('returns away safety multipliers for vacation and sick founder states', () => {
    expect(safetyMultipliersForFounderState('Vacation')).toEqual({
      bufferMultiplier: 1.25,
      leadTimeMultiplier: 1.4,
    })
  })
})
