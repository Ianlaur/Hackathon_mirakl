import { prisma } from '@/lib/prisma'
import { renderTemplate } from '@/lib/mira/templates'

export type DecisionTemplateRow = {
  id: string
  description: string | null
}

export type DecisionLedgerRow = {
  id: string
  user_id: string
  sku: string | null
  channel: string | null
  action_type: string
  template_id: string
  logical_inference: string
  raw_payload: Record<string, unknown> | null
  status: string
  reversible: boolean
  source_agent: string | null
  triggered_by: string | null
  created_at: Date
  executed_at: Date | null
  founder_decision_at: Date | null
  trigger_event_id: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function englishReason(value: unknown) {
  const reason = String(value || '').trim()
  if (!reason) return 'operator review'

  const normalized = reason
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (normalized.includes('rupture imminente')) return 'imminent stockout'
  if (normalized.includes('risque de rupture')) return 'oversell risk'
  if (normalized.includes('top seller')) return 'top seller badge protection'
  return reason
}

function buildOriginalProposalFromRequest(request: Record<string, unknown>) {
  const actionType = String(request.action_type || '').trim()
  const sku = String(request.sku || '').trim()
  const channel = String(request.channel || '').trim()
  const params = asRecord(request.params)
  const reason = englishReason(params.reason)

  if (actionType === 'pause_listing') {
    return `pause ${sku} on ${channel}. Reason: ${reason}.`
  }

  if (actionType === 'flag_oversell') {
    return `flag oversell risk on ${sku}${channel ? ` for ${channel}` : ''}.`
  }

  if (actionType) {
    return `${actionType}${sku ? ` for ${sku}` : ''}${channel ? ` on ${channel}` : ''}.`
  }

  return 'manual review.'
}

export function buildTemplateInputFromLedgerRow(args: {
  templateId: string
  rawPayload: unknown
  fallback?: Partial<DecisionLedgerRow> & Record<string, unknown>
  founderReturnsOn?: string | null
}) {
  const payload = asRecord(args.rawPayload)
  const applied = asRecord(payload.applied_template_input)
  const request = asRecord(payload.request)

  switch (args.templateId) {
    case 'vacation_queue_v1':
      return {
        ...applied,
        request,
        founder_returns_on:
          args.founderReturnsOn ||
          String(payload.founder_returns_on || payload.until || args.fallback?.founder_returns_on || ''),
        original_proposal:
          String(payload.original_proposal || payload.summary || '').trim() ||
          buildOriginalProposalFromRequest(request),
      }
    case 'reputation_shield_v1':
      return {
        ...applied,
        primary_channel: payload.primary_channel ?? args.fallback?.channel ?? '',
        secondary_channels: Array.isArray(payload.paused_channels) ? payload.paused_channels : [],
        secondary_channel_count: Array.isArray(payload.paused_channels)
          ? payload.paused_channels.length
          : Number(payload.secondary_channel_count || 0),
        reason: englishReason(payload.reason),
      }
    case 'listing_pause_v1':
      return {
        ...applied,
        sku: applied.sku ?? request.sku ?? args.fallback?.sku ?? '',
        channel: applied.channel ?? request.channel ?? args.fallback?.channel ?? '',
        reason: englishReason(applied.reason ?? asRecord(request.params).reason),
      }
    case 'listing_resume_v1':
      return {
        ...applied,
        sku: applied.sku ?? request.sku ?? args.fallback?.sku ?? '',
        channel: applied.channel ?? request.channel ?? args.fallback?.channel ?? '',
      }
    default:
      return {
        ...payload,
        ...applied,
      }
  }
}

export async function listDecisionTemplates() {
  return prisma.$queryRaw<DecisionTemplateRow[]>`
    SELECT id, description
    FROM public.decision_templates
    ORDER BY id
  `
}

export async function listDecisionLedgerRows(limit = 100) {
  return prisma.$queryRaw<DecisionLedgerRow[]>`
    SELECT
      id::text,
      user_id::text,
      sku,
      channel,
      action_type,
      template_id,
      logical_inference,
      raw_payload,
      status,
      reversible,
      source_agent,
      triggered_by,
      created_at,
      executed_at,
      founder_decision_at,
      trigger_event_id
    FROM public.decision_ledger
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, limit)}
  `
}

export async function listDistinctLedgerTemplateIds() {
  const rows = await prisma.$queryRaw<Array<{ template_id: string }>>`
    SELECT DISTINCT template_id
    FROM public.decision_ledger
    ORDER BY template_id
  `

  return rows.map((row) => row.template_id)
}

export async function createDecisionLedgerEntry(input: {
  userId: string
  sku?: string | null
  channel?: string | null
  actionType: string
  templateId: string
  templateInput: Record<string, unknown>
  rawPayload?: Record<string, unknown> | null
  status: string
  reversible?: boolean
  sourceAgent?: string | null
  triggeredBy?: string | null
  triggerEventId?: string | null
}) {
  const logicalInference = renderTemplate(input.templateId, input.templateInput)
  const rawPayload = {
    ...(input.rawPayload || {}),
    applied_template_input: input.templateInput,
  }

  const rows = await prisma.$queryRaw<DecisionLedgerRow[]>`
    INSERT INTO public.decision_ledger (
      user_id,
      sku,
      channel,
      action_type,
      template_id,
      logical_inference,
      raw_payload,
      status,
      reversible,
      source_agent,
      triggered_by,
      trigger_event_id
    ) VALUES (
      ${input.userId}::uuid,
      ${input.sku ?? null},
      ${input.channel ?? null},
      ${input.actionType},
      ${input.templateId},
      ${logicalInference},
      ${rawPayload}::jsonb,
      ${input.status},
      ${input.reversible ?? false},
      ${input.sourceAgent ?? null},
      ${input.triggeredBy ?? null},
      ${input.triggerEventId ?? null}
    )
    RETURNING
      id::text,
      user_id::text,
      sku,
      channel,
      action_type,
      template_id,
      logical_inference,
      raw_payload,
      status,
      reversible,
      source_agent,
      triggered_by,
      created_at,
      executed_at,
      founder_decision_at,
      trigger_event_id
  `

  return rows[0]
}

export async function updateDecisionLedgerStatus(input: {
  decisionId: string
  userId: string
  status: string
}) {
  const rows = await prisma.$queryRaw<DecisionLedgerRow[]>`
    UPDATE public.decision_ledger
    SET
      status = ${input.status},
      founder_decision_at = now(),
      executed_at = CASE
        WHEN ${input.status} IN ('auto_executed', 'approved', 'rejected', 'overridden')
          THEN COALESCE(executed_at, now())
        ELSE executed_at
      END
    WHERE id = ${input.decisionId}::uuid
      AND user_id = ${input.userId}::uuid
    RETURNING
      id::text,
      user_id::text,
      sku,
      channel,
      action_type,
      template_id,
      logical_inference,
      raw_payload,
      status,
      reversible,
      source_agent,
      triggered_by,
      created_at,
      executed_at,
      founder_decision_at,
      trigger_event_id
  `

  return rows[0] ?? null
}

export async function rewriteDecisionLedgerLogicalInference(input: {
  decisionId: string
  templateId: string
  templateInput: Record<string, unknown>
}) {
  const logicalInference = renderTemplate(input.templateId, input.templateInput)
  const rows = await prisma.$queryRaw<DecisionLedgerRow[]>`
    UPDATE public.decision_ledger
    SET
      logical_inference = ${logicalInference},
      raw_payload = jsonb_set(
        COALESCE(raw_payload, '{}'::jsonb),
        '{applied_template_input}',
        ${input.templateInput}::jsonb,
        true
      )
    WHERE id = ${input.decisionId}::uuid
    RETURNING
      id::text,
      user_id::text,
      sku,
      channel,
      action_type,
      template_id,
      logical_inference,
      raw_payload,
      status,
      reversible,
      source_agent,
      triggered_by,
      created_at,
      executed_at,
      founder_decision_at,
      trigger_event_id
  `

  return rows[0] ?? null
}

export async function createOverrideRecord(input: {
  userId: string
  decisionId: string
  reason?: string | null
  previousStatus?: string | null
}) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      user_id: string
      decision_id: string
      reason: string | null
      previous_status: string | null
      created_at: Date
    }>
  >`
    INSERT INTO public.override_records (
      user_id,
      decision_id,
      reason,
      previous_status
    ) VALUES (
      ${input.userId}::uuid,
      ${input.decisionId}::uuid,
      ${input.reason ?? null},
      ${input.previousStatus ?? null}
    )
    RETURNING id::text, user_id::text, decision_id::text, reason, previous_status, created_at
  `

  return rows[0]
}
