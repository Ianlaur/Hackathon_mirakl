const fs = require('fs')
const path = require('path')
const { prisma } = require('../lib/prisma')
const { renderTemplate } = require('../lib/mira/templates')

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

async function main() {
  loadLocalEnv()

  const founderRows = await prisma.$queryRaw`
    SELECT user_id::text, until
    FROM public.founder_state
  `

  const founderReturnsByUser = new Map(
    founderRows.map((row) => [
      row.user_id,
      row.until ? new Date(row.until).toISOString().slice(0, 10) : null,
    ])
  )

  const rows = await prisma.$queryRaw`
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
    LIMIT 500
  `
  let updated = 0

  for (const row of rows) {
    const templateInput = buildTemplateInputFromRow(
      row,
      founderReturnsByUser.get(row.user_id) || null
    )
    const logicalInference = renderTemplate(row.template_id, templateInput)

    const next = await prisma.$queryRaw`
      UPDATE public.decision_ledger
      SET
        logical_inference = ${logicalInference},
        raw_payload = jsonb_set(
          COALESCE(raw_payload, '{}'::jsonb),
          '{applied_template_input}',
          ${templateInput}::jsonb,
          true
        )
      WHERE id = ${row.id}::uuid
      RETURNING id::text
    `

    if (Array.isArray(next) && next.length > 0) updated += 1
  }

  console.log(`Updated ${updated} decision_ledger rows with English logical_inference traces.`)
}

main()
  .catch((error) => {
    console.error('backfill-mira-ledger-english failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function englishReason(value) {
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

function buildOriginalProposalFromRequest(request) {
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

function buildTemplateInputFromRow(row, founderReturnsOn) {
  const payload = asRecord(row.raw_payload)
  const applied = asRecord(payload.applied_template_input)
  const request = asRecord(payload.request)

  switch (row.template_id) {
    case 'vacation_queue_v1':
      return {
        ...applied,
        request,
        founder_returns_on:
          founderReturnsOn || String(payload.founder_returns_on || payload.until || ''),
        original_proposal:
          String(payload.original_proposal || payload.summary || '').trim() ||
          buildOriginalProposalFromRequest(request),
      }
    case 'reputation_shield_v1':
      return {
        ...applied,
        primary_channel: payload.primary_channel || row.channel || '',
        secondary_channels: Array.isArray(payload.paused_channels) ? payload.paused_channels : [],
        secondary_channel_count: Array.isArray(payload.paused_channels)
          ? payload.paused_channels.length
          : Number(payload.secondary_channel_count || 0),
        reason: englishReason(payload.reason),
      }
    case 'listing_pause_v1':
      return {
        ...applied,
        sku: applied.sku || request.sku || row.sku || '',
        channel: applied.channel || request.channel || row.channel || '',
        reason: englishReason(applied.reason || asRecord(request.params).reason),
      }
    case 'listing_resume_v1':
      return {
        ...applied,
        sku: applied.sku || request.sku || row.sku || '',
        channel: applied.channel || request.channel || row.channel || '',
      }
    default:
      return {
        ...payload,
        ...applied,
      }
  }
}
