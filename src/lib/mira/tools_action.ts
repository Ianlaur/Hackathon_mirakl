// MIRA — ACTION tools. Every action goes through FounderPolicy (policy.ts) and
// decision_ledger. The LLM CANNOT write to decision_ledger directly — only through
// execute_action, which builds a template-backed record the DB trigger accepts.

import type { PrismaClient } from '@prisma/client'
import { evaluatePolicy, evaluateReputationShield, type ActionType, type FounderStateValue } from './policy'
import { type TemplateId, type TemplateInputs } from './templates'
import type { OpenAITool } from './tools_read'
import { loadGovernance, resolveAutonomy } from './agents/founderContext'
import { buildOversellRisk } from './agents/stock'
import { buildRestockProposal } from './agents/restock'

export type ActionToolContext = {
  prisma: PrismaClient
  userId: string
}

export const ACTION_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'execute_action',
      description:
        "Seul point d'entrée pour agir. Route l'action à travers FounderPolicy puis écrit dans decision_ledger via un template enregistré. Tu l'appelles toujours quand tu veux pauser/reprendre un listing, proposer un réassort, ajuster un buffer, signaler un oversell.",
      parameters: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: ['pause_listing', 'resume_listing', 'propose_restock', 'adjust_buffer', 'flag_oversell'],
          },
          sku: { type: 'string' },
          channel: { type: 'string', description: 'Requis pour pause_listing / resume_listing.' },
          params: {
            type: 'object',
            description:
              "Paramètres spécifiques: {reason} pour pause_listing; {qty, velocity_per_week, lead_time_weeks, buffer_weeks} pour propose_restock (qty optionnel, sera recalculé si absent); {old_buffer, new_buffer, reason} pour adjust_buffer; {total_24h, velocity_24h, on_hand} pour flag_oversell.",
            properties: {},
            additionalProperties: true,
          },
          trigger_event_id: {
            type: 'string',
            description:
              "external_id de la commande / retour / événement opérationnel qui a déclenché cette décision (ex: 'ORD-000236'). Rend la trace rejouable via operational_objects.",
          },
        },
        required: ['action_type', 'sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_founder_state',
      description: 'Met à jour la disponibilité du fondateur (singleton). Vacation/Sick élargit automatiquement les buffers.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['Active', 'Vacation', 'Sick', 'Busy'] },
          until: { type: 'string', description: 'Date ISO 8601 de fin, ex: 2026-05-01T00:00:00Z' },
          notes: { type: 'string' },
        },
        required: ['state'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_autonomy',
      description: "Change le mode pour un action_type (observe | propose | auto_execute, UI: Watching | Ask me | Handle it).",
      parameters: {
        type: 'object',
        properties: {
          action_type: { type: 'string' },
          mode: { type: 'string', enum: ['observe', 'propose', 'auto_execute'] },
        },
        required: ['action_type', 'mode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_decision',
      description: 'Approuve une décision en statut proposed → auto_executed.',
      parameters: {
        type: 'object',
        properties: { decision_id: { type: 'string', description: 'UUID de la ligne decision_ledger' } },
        required: ['decision_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reject_decision',
      description: 'Rejette une décision proposed → rejected. reason optionnel.',
      parameters: {
        type: 'object',
        properties: {
          decision_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['decision_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'override_decision',
      description: 'Annule une décision déjà auto_executed. Crée un override_records et passe le ledger à overridden.',
      parameters: {
        type: 'object',
        properties: {
          decision_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['decision_id'],
      },
    },
  },
]

type ExecuteArgs = {
  action_type: ActionType | 'flag_oversell'
  sku: string
  channel?: string
  params?: Record<string, unknown>
  trigger_event_id?: string
}

function buildTemplatePayload(
  args: ExecuteArgs,
  multipliers: { buffer: number; leadTime: number },
): { templateId: TemplateId; input: TemplateInputs[TemplateId]; mappedActionType: ActionType } {
  const p = args.params ?? {}

  switch (args.action_type) {
    case 'pause_listing':
      return {
        templateId: 'listing_pause_v1',
        mappedActionType: 'pause_listing',
        input: {
          sku: args.sku,
          channel: String(args.channel ?? p.channel ?? 'unknown'),
          reason: String(p.reason ?? 'raison non précisée'),
        },
      }
    case 'resume_listing':
      return {
        templateId: 'listing_resume_v1',
        mappedActionType: 'resume_listing',
        input: {
          sku: args.sku,
          channel: String(args.channel ?? p.channel ?? 'unknown'),
        },
      }
    case 'propose_restock':
      return {
        templateId: 'restock_proposal_v1',
        mappedActionType: 'propose_restock',
        input: buildRestockProposal(
          {
            sku: args.sku,
            velocity_per_week: Number(p.velocity_per_week ?? 0),
            lead_time_weeks: Number(p.lead_time_weeks ?? 2),
            buffer_weeks: Number(p.buffer_weeks ?? 2),
            on_hand: p.on_hand !== undefined ? Number(p.on_hand) : undefined,
            incoming: p.incoming !== undefined ? Number(p.incoming) : undefined,
            explicit_qty: p.qty !== undefined ? Number(p.qty) : undefined,
          },
          multipliers,
        ),
      }
    case 'adjust_buffer':
      return {
        templateId: 'buffer_adjustment_v1',
        mappedActionType: 'adjust_buffer',
        input: {
          sku: args.sku,
          old_buffer: Number(p.old_buffer ?? 0),
          new_buffer: Number(p.new_buffer ?? 0),
          reason: String(p.reason ?? 'ajustement'),
        },
      }
    case 'flag_oversell':
      return {
        templateId: 'oversell_risk_v1',
        mappedActionType: 'pause_listing', // reversible: the natural follow-up is a pause
        input: buildOversellRisk({
          sku: args.sku,
          total_24h: Number(p.total_24h ?? 0),
          velocity_24h: Number(p.velocity_24h ?? 0),
          on_hand: Number(p.on_hand ?? 0),
        }),
      }
    default:
      throw new Error(`execute_action: unsupported action_type "${args.action_type}"`)
  }
}

async function executeAction(ctx: ActionToolContext, args: ExecuteArgs) {
  const gov = await loadGovernance(ctx.prisma, ctx.userId)
  const mapped = buildTemplatePayload(args, gov.multipliers)
  const autonomy = resolveAutonomy(gov, mapped.mappedActionType)

  const decision = evaluatePolicy({
    actionType: mapped.mappedActionType,
    autonomy,
    founderState: gov.founderState,
    templateId: mapped.templateId,
    templateInput: mapped.input,
    vacationQueue: {
      return_date: gov.founderUntil ? gov.founderUntil.toISOString().slice(0, 10) : 'à définir',
      original_action: `${args.action_type} ${args.sku}`,
    },
  })

  if (decision.status === 'skipped') {
    return {
      acted: false,
      status: 'skipped',
      message: `Mode observe actif sur ${mapped.mappedActionType}. Trace non enregistrée.`,
      rendered: decision.rendered,
    }
  }

  const record = await ctx.prisma.decisionRecord.create({
    data: {
      user_id: ctx.userId,
      sku: args.sku,
      channel: args.channel ?? null,
      action_type: mapped.mappedActionType,
      template_id: decision.templateId,
      logical_inference: decision.rendered,
      raw_payload: {
        request: args,
        applied_template_input: mapped.input,
        multipliers: decision.multipliers,
      } as any,
      status: decision.status,
      reversible: decision.reversible,
      source_agent: 'conversation',
      triggered_by: 'founder',
      trigger_event_id: args.trigger_event_id ?? null,
      executed_at: decision.status === 'auto_executed' ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      template_id: true,
      logical_inference: true,
      trigger_event_id: true,
      created_at: true,
    },
  })

  return {
    acted: true,
    decision_id: record.id,
    status: record.status,
    template_id: record.template_id,
    message: record.logical_inference,
    undo_hint:
      record.status === 'auto_executed' && decision.reversible
        ? `Pour annuler: override_decision(${record.id}).`
        : record.status === 'proposed'
          ? `Pour approuver: approve_decision(${record.id}). Pour rejeter: reject_decision(${record.id}, reason).`
          : record.status === 'queued'
            ? `Mise en file (fondateur absent). Sera reprise à son retour.`
            : null,
  }
}

async function setFounderState(ctx: ActionToolContext, args: Record<string, any>) {
  const until = args.until ? new Date(String(args.until)) : null
  const newState = String(args.state) as FounderStateValue
  const row = await ctx.prisma.founderState.upsert({
    where: { user_id: ctx.userId },
    create: {
      user_id: ctx.userId,
      state: newState,
      until,
      notes: args.notes ? String(args.notes) : null,
    },
    update: {
      state: newState,
      until,
      notes: args.notes ? String(args.notes) : null,
    },
  })

  // Reputation Shield — deterministic rule. Entering Vacation/Sick protects the
  // primary storefront by reducing exposure on secondary channels. Fires once here
  // (not per decision) and writes a single reputation_shield_v1 ledger entry.
  const shield = await evaluateReputationShield(ctx.prisma, ctx.userId, newState)
  let shieldDecision = null
  if (shield?.shouldApply) {
    shieldDecision = await ctx.prisma.decisionRecord.create({
      data: {
        user_id: ctx.userId,
        action_type: 'reputation_shield',
        template_id: 'reputation_shield_v1',
        logical_inference: shield.rendered,
        raw_payload: {
          primary_channel: shield.primary_channel,
          paused_channels: shield.paused_channels,
          reason: shield.reason,
        },
        status: 'auto_executed',
        reversible: true,
        source_agent: 'founder_policy',
        triggered_by: 'set_founder_state',
        executed_at: new Date(),
      },
      select: { id: true, logical_inference: true, template_id: true },
    })
  }

  return { updated: true, founder: row, reputation_shield: shieldDecision }
}

async function updateAutonomy(ctx: ActionToolContext, args: Record<string, any>) {
  const row = await ctx.prisma.autonomyConfig.upsert({
    where: {
      user_id_action_type: {
        user_id: ctx.userId,
        action_type: String(args.action_type),
      },
    },
    create: {
      user_id: ctx.userId,
      action_type: String(args.action_type),
      mode: String(args.mode),
    },
    update: { mode: String(args.mode) },
  })
  return { updated: true, autonomy: row }
}

async function approveDecision(ctx: ActionToolContext, args: Record<string, any>) {
  const row = await ctx.prisma.decisionRecord.update({
    where: { id: String(args.decision_id) },
    data: { status: 'auto_executed', executed_at: new Date(), founder_decision_at: new Date() },
    select: { id: true, status: true },
  })
  return { approved: true, decision: row }
}

async function rejectDecision(ctx: ActionToolContext, args: Record<string, any>) {
  const row = await ctx.prisma.decisionRecord.update({
    where: { id: String(args.decision_id) },
    data: { status: 'rejected', founder_decision_at: new Date() },
    select: { id: true, status: true },
  })
  if (args.reason) {
    await ctx.prisma.overrideRecord.create({
      data: {
        user_id: ctx.userId,
        decision_id: row.id,
        reason: String(args.reason),
        previous_status: 'proposed',
      },
    })
  }
  return { rejected: true, decision: row }
}

async function overrideDecision(ctx: ActionToolContext, args: Record<string, any>) {
  const previous = await ctx.prisma.decisionRecord.findUniqueOrThrow({
    where: { id: String(args.decision_id) },
    select: { status: true },
  })
  const row = await ctx.prisma.decisionRecord.update({
    where: { id: String(args.decision_id) },
    data: { status: 'overridden', founder_decision_at: new Date() },
    select: { id: true, status: true, template_id: true },
  })
  await ctx.prisma.overrideRecord.create({
    data: {
      user_id: ctx.userId,
      decision_id: row.id,
      reason: args.reason ? String(args.reason) : null,
      previous_status: previous.status,
    },
  })
  return { overridden: true, decision: row }
}

export async function executeActionTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ActionToolContext,
): Promise<unknown> {
  switch (name) {
    case 'execute_action': return executeAction(ctx, args as unknown as ExecuteArgs)
    case 'set_founder_state': return setFounderState(ctx, args)
    case 'update_autonomy': return updateAutonomy(ctx, args)
    case 'approve_decision': return approveDecision(ctx, args)
    case 'reject_decision': return rejectDecision(ctx, args)
    case 'override_decision': return overrideDecision(ctx, args)
    default: throw new Error(`Unknown action tool: ${name}`)
  }
}
