import { decryptSecret } from '@/lib/crypto'
import type { PlanItem } from '@/lib/calendar-restock'

export type LlmEnrichmentInput = {
  leaveTitle: string
  leaveStart: Date
  leaveEnd: Date
  atRiskItems: PlanItem[]
  coincidingEvents: Array<{ title: string; kind: string; start: Date; end: Date }>
  merchantProfile: {
    merchantCategory: string | null
    operatingRegions: string[]
    supplierRegions: string[]
    seasonalityTags: string[]
  } | null
}

export type LlmEnrichmentOutput = {
  reasoningSummary: string
  expectedImpact: string
  confidenceNote: string
  supplementaryNotes: string[]
  fallback: boolean
}

const SYSTEM_PROMPT = `You are an operations advisor for a solo merchant preparing for a leave period.
Given the leave event, the list of at-risk SKUs with deterministic calculations, any calendar events coinciding with the leave, and the merchant profile, produce a JSON object with:
- reasoningSummary: narrative explanation in FRENCH (2-4 sentences, empathetic tone, uses the merchant's "tu" form)
- expectedImpact: short sentence in FRENCH describing the business outcome if the merchant approves
- confidenceNote: short sentence in FRENCH describing the confidence level and what could shift the recommendation
- supplementaryNotes: array of short strings in FRENCH (e.g. "Nouvel An chinois tombe pendant tes congés, ton fournisseur asiatique sera fermé.")

Respond ONLY in valid JSON. No markdown, no commentary.`

export function buildDeterministicFallback(input: LlmEnrichmentInput): LlmEnrichmentOutput {
  const count = input.atRiskItems.length
  const totalCost = input.atRiskItems.reduce((s, i) => s + i.estimatedCostEur, 0)
  const reasoningSummary =
    count === 0
      ? `Aucun SKU à risque détecté pour ton absence. Tu peux partir tranquille.`
      : `${count} produits risquent la rupture pendant tes congés. Passe les commandes avant la deadline pour être livré à temps.`
  const expectedImpact =
    count === 0
      ? `Aucun impact attendu.`
      : `Éviter ${count} ruptures potentielles pendant ton absence et protéger ${totalCost.toFixed(0)} € de chiffre d'affaires.`
  const confidenceNote = `Confiance : élevée sur le filtrage déterministe, dépend de la stabilité de la vélocité de vente.`
  return {
    reasoningSummary,
    expectedImpact,
    confidenceNote,
    supplementaryNotes: [],
    fallback: true,
  }
}

export async function enrichWithLlm(
  input: LlmEnrichmentInput,
  opts: { apiKey: string; model: string }
): Promise<LlmEnrichmentOutput> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            leaveTitle: input.leaveTitle,
            leaveStart: input.leaveStart.toISOString().slice(0, 10),
            leaveEnd: input.leaveEnd.toISOString().slice(0, 10),
            atRiskItems: input.atRiskItems.map((i) => ({
              sku: i.sku,
              productName: i.productName,
              currentStock: i.currentStock,
              recommendedQty: i.recommendedQty,
              supplier: i.supplier,
              leadTimeDays: i.leadTimeDays,
              priority: i.priority,
            })),
            coincidingEvents: input.coincidingEvents.map((e) => ({
              title: e.title,
              kind: e.kind,
              start: e.start.toISOString().slice(0, 10),
              end: e.end.toISOString().slice(0, 10),
            })),
            merchantProfile: input.merchantProfile,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`)
  }
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI response missing content')
  }

  const parsed = JSON.parse(content) as Partial<LlmEnrichmentOutput>
  if (!parsed.reasoningSummary || !parsed.expectedImpact || !parsed.confidenceNote) {
    throw new Error('OpenAI response missing required fields')
  }

  return {
    reasoningSummary: parsed.reasoningSummary,
    expectedImpact: parsed.expectedImpact,
    confidenceNote: parsed.confidenceNote,
    supplementaryNotes: parsed.supplementaryNotes ?? [],
    fallback: false,
  }
}

export async function enrichWithFallback(
  input: LlmEnrichmentInput,
  encryptedApiKey: string | null | undefined,
  model: string
): Promise<LlmEnrichmentOutput> {
  if (!encryptedApiKey) {
    return buildDeterministicFallback(input)
  }
  try {
    const apiKey = decryptSecret(encryptedApiKey)
    return await enrichWithLlm(input, { apiKey, model })
  } catch (err) {
    console.error('LLM enrichment failed, using fallback:', err)
    return buildDeterministicFallback(input)
  }
}
