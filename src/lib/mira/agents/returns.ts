// ReturnsAgent — detects a returns pattern above baseline for a SKU/reason combination.
// Pure function; data loading is the caller's responsibility.

import type { TemplateInputs } from '../templates'

export type ReturnsPatternInput = {
  sku: string
  matching_returns: number
  window: string
  reason_code: string
  total_returns: number
  baseline_pct: number
}

export function buildReturnsPattern(
  input: ReturnsPatternInput,
): TemplateInputs['returns_pattern_v1'] {
  const ratePct =
    input.total_returns > 0
      ? Number(((input.matching_returns / input.total_returns) * 100).toFixed(1))
      : 0
  return {
    sku: input.sku,
    matching_returns: input.matching_returns,
    window: input.window,
    reason_code: input.reason_code,
    rate_pct: ratePct,
    baseline_pct: Number(input.baseline_pct.toFixed(1)),
  }
}

export function isPatternAboveBaseline(
  input: ReturnsPatternInput,
  marginPct = 5,
): boolean {
  if (input.total_returns === 0) return false
  const rate = (input.matching_returns / input.total_returns) * 100
  return rate >= input.baseline_pct + marginPct
}
