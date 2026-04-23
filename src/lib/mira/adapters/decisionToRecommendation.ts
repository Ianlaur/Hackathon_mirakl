// Map a MIRA decision_ledger row into the shape Actions page components expect
// (RecommendationDTO). Preserves UI compatibility while swapping the data source.

import type { EvidenceEntry, RecommendationDTO } from '@/app/actions/types'

export type DecisionRecordInput = {
  id: string
  sku: string | null
  channel: string | null
  action_type: string | null
  template_id: string | null
  logical_inference: string | null
  raw_payload: unknown
  status: string
  reversible: boolean
  source_agent: string | null
  triggered_by: string | null
  trigger_event_id?: string | null
  created_at: Date
  executed_at: Date | null
  founder_decision_at: Date | null
}

// Map MIRA ledger statuses → ActionsPageClient statuses so the tab filter works.
// proposed/queued → pending_approval
// auto_executed/approved → approved
// overridden/rejected → rejected
// skipped → skipped (will be filtered out by the All tab visually)
function mapStatus(status: string): string {
  switch (status) {
    case 'proposed':
    case 'queued':
      return 'pending_approval'
    case 'auto_executed':
    case 'approved':
      return 'approved'
    case 'overridden':
    case 'rejected':
      return 'rejected'
    default:
      return status
  }
}

const TEMPLATE_TITLE: Record<string, (sku: string | null) => string> = {
  oversell_risk_v1: (sku) => (sku ? `Risque d'oversell — ${sku}` : "Risque d'oversell"),
  restock_proposal_v1: (sku) => (sku ? `Proposition de réassort — ${sku}` : 'Proposition de réassort'),
  seasonal_prediction_v1: (sku) => (sku ? `Pic saisonnier — ${sku}` : 'Pic saisonnier détecté'),
  returns_pattern_v1: (sku) => (sku ? `Retours récurrents — ${sku}` : 'Retours récurrents'),
  reputation_shield_v1: () => 'Protection des avis',
  vacation_queue_v1: () => 'Action en file (vacances)',
  calendar_posture_v1: (sku) => (sku ? `Calendrier commercial — ${sku}` : 'Calendrier commercial'),
  listing_pause_v1: (sku) => (sku ? `Pause du listing — ${sku}` : 'Pause du listing'),
  listing_resume_v1: (sku) => (sku ? `Reprise du listing — ${sku}` : 'Reprise du listing'),
  buffer_adjustment_v1: (sku) => (sku ? `Ajustement du buffer — ${sku}` : 'Ajustement du buffer'),
  fuse_tripped_v1: () => 'Fusible déclenché',
  reconciliation_variance_v1: (sku) => (sku ? `Écart de réconciliation — ${sku}` : 'Écart de réconciliation'),
  carrier_audit_v1: (sku) => (sku ? `Audit transporteur — ${sku}` : 'Audit transporteur'),
  supplier_scorecard_v1: () => 'Scorecard fournisseur',
}

const CHANNEL_LABEL: Record<string, string> = {
  amazon_fr: 'Amazon FR',
  amazon_it: 'Amazon IT',
  amazon_de: 'Amazon DE',
  google_shopping_fr: 'Google Shopping FR',
  google_shopping_it: 'Google Shopping IT',
  google_shopping_de: 'Google Shopping DE',
}

function buildEvidence(d: DecisionRecordInput): EvidenceEntry[] {
  const entries: EvidenceEntry[] = []
  if (d.sku) entries.push({ label: 'SKU', value: d.sku })
  if (d.channel) entries.push({ label: 'Canal', value: CHANNEL_LABEL[d.channel] ?? d.channel })
  if (d.action_type) entries.push({ label: 'Action', value: d.action_type })
  if (d.source_agent) entries.push({ label: 'Agent', value: d.source_agent })
  if (d.triggered_by) entries.push({ label: 'Événement', value: d.triggered_by })
  entries.push({ label: 'Réversible', value: d.reversible ? 'oui' : 'non' })
  return entries
}

export function decisionToRecommendation(d: DecisionRecordInput): RecommendationDTO {
  const titleFn = (d.template_id && TEMPLATE_TITLE[d.template_id]) ?? null
  const title = titleFn ? titleFn(d.sku) : (d.logical_inference?.split('\n')[0] ?? 'Décision MIRA')
  const scenario = d.template_id ? d.template_id.replace(/_v\d+$/, '') : 'mira_decision'

  return {
    id: d.id,
    title,
    scenario_type: scenario,
    status: mapStatus(d.status),
    reasoning_summary: d.logical_inference ?? '',
    expected_impact: null,
    confidence_note: null,
    evidence_payload: buildEvidence(d),
    action_payload: null, // MIRA decisions don't carry the copilot vacation-planner payload shape
    approval_required: d.status === 'proposed' || d.status === 'queued',
    source: d.source_agent ?? 'mira',
    created_at: d.created_at.toISOString(),
    updated_at: (d.founder_decision_at ?? d.executed_at ?? d.created_at).toISOString(),
  }
}
