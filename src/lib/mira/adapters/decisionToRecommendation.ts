import type { RecommendationDTO, EvidenceEntry } from '@/app/actions/types'

export type DecisionRecordInput = {
  id: string
  sku: string | null
  channel: string | null
  action_type: string
  template_id: string
  logical_inference: string
  raw_payload: unknown
  status: string
  reversible: boolean
  source_agent: string | null
  triggered_by: string | null
  trigger_event_id: string | null
  created_at: Date | string
  executed_at: Date | string | null
  founder_decision_at: Date | string | null
}

const TITLE_BY_TEMPLATE: Record<string, string> = {
  oversell_risk_v1: 'Stock en tension',
  restock_proposal_v1: 'Proposition de réassort',
  vacation_queue_v1: 'En file — retour fondatrice',
  reputation_shield_v1: 'Protection des avis',
  returns_pattern_v1: 'Motif de retours',
  seasonal_prediction_v1: 'Prédiction saisonnière',
  listing_pause_v1: 'Pause de listing',
  listing_resume_v1: 'Reprise de listing',
  buffer_adjustment_v1: 'Ajustement de buffer',
  calendar_posture_v1: 'Posture calendrier',
  fuse_tripped_v1: 'Fuse déclenché',
  reconciliation_variance_v1: 'Écart de réconciliation',
  carrier_audit_v1: 'Audit transporteur',
  supplier_scorecard_v1: 'Score fournisseur',
}

function toIso(v: Date | string | null | undefined): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString()
  return v
}

function buildEvidence(d: DecisionRecordInput): EvidenceEntry[] {
  const entries: EvidenceEntry[] = []
  if (d.sku) entries.push({ label: 'SKU', value: d.sku })
  if (d.channel) entries.push({ label: 'Canal', value: d.channel })
  entries.push({ label: 'Action', value: d.action_type })
  if (d.source_agent) entries.push({ label: 'Agent', value: d.source_agent })
  if (d.trigger_event_id) entries.push({ label: 'Événement', value: d.trigger_event_id })
  entries.push({ label: 'Réversible', value: d.reversible ? 'Oui' : 'Non' })
  return entries
}

export function decisionToRecommendation(d: DecisionRecordInput): RecommendationDTO {
  const title = TITLE_BY_TEMPLATE[d.template_id] ?? d.template_id
  const updatedAt = toIso(d.executed_at) ?? toIso(d.founder_decision_at) ?? toIso(d.created_at)!

  return {
    id: d.id,
    title,
    scenario_type: d.template_id,
    status: d.status,
    reasoning_summary: d.logical_inference || title,
    expected_impact: null,
    confidence_note: null,
    evidence_payload: buildEvidence(d),
    action_payload: null,
    approval_required: d.status === 'proposed' || d.status === 'queued',
    source: d.source_agent ?? 'leia',
    created_at: toIso(d.created_at)!,
    updated_at: updatedAt,
  }
}
