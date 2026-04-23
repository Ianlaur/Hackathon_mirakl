// MIRA — Safety fuses. Deterministic circuit breakers. No LLM involvement.
// A fuse either trips or it doesn't — same inputs, same verdict.
// When tripped, the caller builds a fuse_tripped_v1 template record + the recommended action.

import type { TemplateInputs } from './templates'

export type FuseName =
  | 'returns_rate_fuse'
  | 'oversell_rate_fuse'
  | 'reconciliation_variance_fuse'

export type FuseVerdict = {
  name: FuseName
  tripped: true
  template: TemplateInputs['fuse_tripped_v1']
  suggested_action_type: 'pause_listing' | 'flag_returns_pattern' | 'flag_reconciliation_variance'
} | {
  name: FuseName
  tripped: false
}

// Returns rate: if rate on window exceeds threshold, pause the listing.
const RETURNS_RATE_THRESHOLD = 0.15

export function checkReturnsRateFuse(m: {
  sku: string
  returns_rate: number
  window: string
}): FuseVerdict {
  if (m.returns_rate <= RETURNS_RATE_THRESHOLD) {
    return { name: 'returns_rate_fuse', tripped: false }
  }
  return {
    name: 'returns_rate_fuse',
    tripped: true,
    template: {
      fuse_name: 'returns_rate_fuse',
      sku: m.sku,
      metric_name: 'returns_rate',
      metric_value: m.returns_rate,
      window: m.window,
      threshold: RETURNS_RATE_THRESHOLD,
      action: 'pause_listing',
    },
    suggested_action_type: 'pause_listing',
  }
}

// Oversell rate: on_hand shortfall relative to 24h velocity demand.
const OVERSELL_RATE_THRESHOLD = 0.1

export function checkOversellRateFuse(m: {
  sku: string
  oversell_rate: number
  window: string
}): FuseVerdict {
  if (m.oversell_rate <= OVERSELL_RATE_THRESHOLD) {
    return { name: 'oversell_rate_fuse', tripped: false }
  }
  return {
    name: 'oversell_rate_fuse',
    tripped: true,
    template: {
      fuse_name: 'oversell_rate_fuse',
      sku: m.sku,
      metric_name: 'oversell_rate',
      metric_value: m.oversell_rate,
      window: m.window,
      threshold: OVERSELL_RATE_THRESHOLD,
      action: 'pause_listing',
    },
    suggested_action_type: 'pause_listing',
  }
}

// Reconciliation variance: observed vs expected stock delta.
const RECONCILIATION_VARIANCE_THRESHOLD = 0.05

export function checkReconciliationVarianceFuse(m: {
  sku: string
  variance_pct: number
  window: string
}): FuseVerdict {
  if (Math.abs(m.variance_pct) <= RECONCILIATION_VARIANCE_THRESHOLD * 100) {
    return { name: 'reconciliation_variance_fuse', tripped: false }
  }
  return {
    name: 'reconciliation_variance_fuse',
    tripped: true,
    template: {
      fuse_name: 'reconciliation_variance_fuse',
      sku: m.sku,
      metric_name: 'variance_pct',
      metric_value: m.variance_pct,
      window: m.window,
      threshold: RECONCILIATION_VARIANCE_THRESHOLD * 100,
      action: 'flag_reconciliation_variance',
    },
    suggested_action_type: 'flag_reconciliation_variance',
  }
}

export const FUSE_THRESHOLDS = {
  returns_rate: RETURNS_RATE_THRESHOLD,
  oversell_rate: OVERSELL_RATE_THRESHOLD,
  reconciliation_variance_pct: RECONCILIATION_VARIANCE_THRESHOLD * 100,
} as const
