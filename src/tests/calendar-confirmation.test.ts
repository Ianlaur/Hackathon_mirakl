import { describe, expect, it } from 'vitest'
import {
  normalizeConfirmationFlag,
  requiresExplicitCalendarConfirmation,
} from '@/lib/calendar-confirmation'

describe('normalizeConfirmationFlag', () => {
  it('accepts boolean true values', () => {
    expect(normalizeConfirmationFlag(true)).toBe(true)
    expect(normalizeConfirmationFlag('true')).toBe(true)
    expect(normalizeConfirmationFlag('yes')).toBe(true)
    expect(normalizeConfirmationFlag('oui')).toBe(true)
  })

  it('rejects missing or false-like values', () => {
    expect(normalizeConfirmationFlag(false)).toBe(false)
    expect(normalizeConfirmationFlag(undefined)).toBe(false)
    expect(normalizeConfirmationFlag('non')).toBe(false)
  })
})

describe('requiresExplicitCalendarConfirmation', () => {
  it('requires confirmation for leave events when not confirmed', () => {
    expect(requiresExplicitCalendarConfirmation('leave', false)).toBe(true)
  })

  it('allows leave events after explicit confirmation', () => {
    expect(requiresExplicitCalendarConfirmation('leave', 'oui')).toBe(false)
  })

  it('does not block non-leave events', () => {
    expect(requiresExplicitCalendarConfirmation('marketing', false)).toBe(false)
  })
})
