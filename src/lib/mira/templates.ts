// MIRA — template registry. THE invariant: every decision_ledger row is rendered here.
// Same inputs must produce the same output. If you add a template, also:
//   1) INSERT it into public.decision_templates (SQL) so the DB trigger accepts it
//   2) run scripts/test-mira-invariant.ts to confirm consistency.

export type TemplateId =
  | 'oversell_risk_v1'
  | 'restock_proposal_v1'
  | 'vacation_queue_v1'
  | 'returns_pattern_v1'
  | 'reconciliation_variance_v1'
  | 'fuse_tripped_v1'
  | 'calendar_posture_v1'
  | 'listing_pause_v1'
  | 'listing_resume_v1'
  | 'buffer_adjustment_v1'
  | 'reputation_shield_v1'
  | 'seasonal_prediction_v1'
  | 'carrier_audit_v1'
  | 'supplier_scorecard_v1'

export type TemplateInputs = {
  oversell_risk_v1: {
    sku: string
    total_24h: number
    velocity_24h: number
    on_hand: number
  }
  restock_proposal_v1: {
    sku: string
    velocity_per_week: number
    lead_time_weeks: number
    buffer_weeks: number
    qty: number
  }
  vacation_queue_v1: {
    return_date: string
    original_action: string
  }
  returns_pattern_v1: {
    sku: string
    matching_returns: number
    window: string
    reason_code: string
    rate_pct: number
    baseline_pct: number
  }
  reconciliation_variance_v1: {
    sku: string
    observed: number
    expected: number
    variance_pct: number
    threshold_pct: number
    cause: string
  }
  fuse_tripped_v1: {
    fuse_name: string
    sku: string
    metric_name: string
    metric_value: number
    window: string
    threshold: number
    action: string
  }
  calendar_posture_v1: {
    buffer_delta_pct: number
    sku: string
    event_name: string
    event_date: string
    region: string
    evidence_line: string
  }
  listing_pause_v1: {
    sku: string
    channel: string
    reason: string
  }
  listing_resume_v1: {
    sku: string
    channel: string
  }
  buffer_adjustment_v1: {
    sku: string
    old_buffer: number
    new_buffer: number
    reason: string
  }
  reputation_shield_v1: {
    primary_channel: string
    paused_channels: string[]
    reason: string
  }
  seasonal_prediction_v1: {
    sku: string
    event: string
    growth_factor: number
    recommended_buffer: number
  }
  carrier_audit_v1: {
    sku: string
    carrier: string
    damage_rate: number
    recommended_carrier: string
  }
  supplier_scorecard_v1: {
    supplier: string
    avg_delay_days: number
    defect_rate: number
  }
}

type Renderer<K extends TemplateId> = (input: TemplateInputs[K]) => string

// French, short, factual, calm. Past tense for done, present for facts. No emoji.
const TEMPLATES: { [K in TemplateId]: Renderer<K> } = {
  oversell_risk_v1: ({ sku, total_24h, velocity_24h, on_hand }) =>
    `Risque de rupture ${sku}. Ventes 24h: ${total_24h}. Vélocité: ${velocity_24h}/j. Stock: ${on_hand}.`,

  restock_proposal_v1: ({ sku, velocity_per_week, lead_time_weeks, buffer_weeks, qty }) =>
    `Réassort ${sku}: ${qty} unités. Vélocité ${velocity_per_week}/sem, lead time ${lead_time_weeks} sem, buffer ${buffer_weeks} sem.`,

  vacation_queue_v1: ({ return_date, original_action }) =>
    `Action ${original_action} mise en file. Reprise prévue ${return_date}.`,

  returns_pattern_v1: ({ sku, matching_returns, window, reason_code, rate_pct, baseline_pct }) =>
    `Pattern retours ${sku}: ${matching_returns} retours sur ${window} pour raison ${reason_code}. ${rate_pct}% vs ${baseline_pct}% en moyenne.`,

  reconciliation_variance_v1: ({ sku, observed, expected, variance_pct, threshold_pct, cause }) =>
    `Écart stock ${sku}: observé ${observed}, attendu ${expected}, ${variance_pct}% (seuil ${threshold_pct}%). Cause probable: ${cause}.`,

  fuse_tripped_v1: ({ fuse_name, sku, metric_name, metric_value, window, threshold, action }) =>
    `Fusible ${fuse_name} déclenché sur ${sku}. ${metric_name}=${metric_value} sur ${window} (seuil ${threshold}). Action: ${action}.`,

  calendar_posture_v1: ({ buffer_delta_pct, sku, event_name, event_date, region, evidence_line }) =>
    `Buffer ${sku} ajusté ${buffer_delta_pct > 0 ? '+' : ''}${buffer_delta_pct}% pour ${event_name} (${region}, ${event_date}). ${evidence_line}`,

  listing_pause_v1: ({ sku, channel, reason }) =>
    `Pausé ${sku} sur ${channel}. Raison: ${reason}.`,

  listing_resume_v1: ({ sku, channel }) =>
    `Repris ${sku} sur ${channel}.`,

  buffer_adjustment_v1: ({ sku, old_buffer, new_buffer, reason }) =>
    `Buffer ${sku} passé de ${old_buffer} à ${new_buffer} sem. Raison: ${reason}.`,

  reputation_shield_v1: ({ primary_channel, paused_channels, reason }) =>
    `Reputation Shield activé. Canal principal protégé: ${primary_channel}. Exposition réduite sur: ${paused_channels.join(', ')}. ${reason}`,

  seasonal_prediction_v1: ({ sku, event, growth_factor, recommended_buffer }) =>
    `Prévision saisonnière ${sku} pour ${event}. Facteur croissance attendu ×${growth_factor}. Buffer recommandé ${recommended_buffer} sem.`,

  carrier_audit_v1: ({ sku, carrier, damage_rate, recommended_carrier }) =>
    `Audit transporteur ${sku}: ${carrier} taux de casse ${damage_rate}%. Transporteur recommandé: ${recommended_carrier}.`,

  supplier_scorecard_v1: ({ supplier, avg_delay_days, defect_rate }) =>
    `Fiche fournisseur ${supplier}: retard moyen ${avg_delay_days}j, taux défauts ${defect_rate}%.`,
}

export function render<K extends TemplateId>(templateId: K, input: TemplateInputs[K]): string {
  const renderer = TEMPLATES[templateId] as Renderer<K> | undefined
  if (!renderer) {
    throw new Error(`Unknown template_id: ${String(templateId)}`)
  }
  return renderer(input)
}

export function templateIds(): TemplateId[] {
  return Object.keys(TEMPLATES) as TemplateId[]
}

export { TEMPLATES }
