// MIRA — F1 Flash Onboarding. Sends a CSV header + sample rows to GPT-4o,
// asks it to map raw columns to Mirakl taxonomies. Stored in
// catalog_review_records — NEVER in decision_ledger (free-form reasoning
// stays out of the template-enforced ledger).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  filename: z.string().optional(),
  header: z.array(z.string()).min(1).max(120),
  sample_rows: z.array(z.array(z.string())).min(1).max(10),
})

const MIRAKL_FIELDS = [
  { key: 'sku', desc: 'identifiant produit unique' },
  { key: 'name', desc: 'nom produit (Mirakl: product-title)' },
  { key: 'description', desc: 'description produit' },
  { key: 'category', desc: 'catégorie Mirakl' },
  { key: 'brand', desc: 'marque' },
  { key: 'price_eur', desc: 'prix TTC en euros' },
  { key: 'stock', desc: 'quantité disponible' },
  { key: 'weight_grams', desc: 'poids en grammes' },
  { key: 'ean', desc: 'code-barres EAN-13' },
  { key: 'image_url', desc: 'URL image principale' },
  { key: 'ignore', desc: 'colonne sans correspondance Mirakl' },
]

const SYSTEM_PROMPT = `Tu es MIRA, assistante opérationnelle de Nordika Studio.
Ta tâche : mapper chaque colonne d'un CSV fournisseur à un champ Mirakl standard.
Pour chaque colonne brute, choisis un champ dans la liste autorisée et explique
pourquoi en une phrase courte, factuelle, en français. Si aucune correspondance,
utilise 'ignore'.

Réponds UNIQUEMENT en JSON strict (pas de markdown), forme:
{ "mappings": [ { "raw": "...", "proposed": "...", "reasoning": "...", "confidence": 0.0-1.0 } ] }`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY non configurée.' }, { status: 500 })
    }

    const userId = await getCurrentUserId()
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { header, sample_rows, filename } = parsed.data
    const fieldsList = MIRAKL_FIELDS.map((f) => `${f.key} — ${f.desc}`).join('\n')

    const userContent = [
      `Fichier: ${filename ?? 'catalogue.csv'}`,
      `Colonnes brutes (${header.length}): ${JSON.stringify(header)}`,
      `Aperçu (${sample_rows.length} lignes):`,
      ...sample_rows.map((r, i) => `- ligne ${i + 1}: ${JSON.stringify(r)}`),
      '',
      'Champs Mirakl autorisés (exactement, pas de variantes):',
      fieldsList,
      '',
      'Retourne le JSON strict avec un mapping par colonne brute.',
    ].join('\n')

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.MIRA_MODEL || 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return NextResponse.json({ error: `OpenAI ${resp.status}: ${errText}` }, { status: 502 })
    }
    const completion = await resp.json()
    const rawText = completion.choices?.[0]?.message?.content ?? '{"mappings":[]}'
    const parsedJson = JSON.parse(rawText) as { mappings: Array<Record<string, unknown>> }

    const mappings = Array.isArray(parsedJson.mappings) ? parsedJson.mappings : []
    const allowedKeys = new Set(MIRAKL_FIELDS.map((f) => f.key))

    // Persist one catalog_review_record per source file, containing all mappings.
    // Free-form LLM output lives here — never in decision_ledger.
    const record = await prisma.catalogReviewRecord.create({
      data: {
        user_id: userId,
        sku: filename ?? 'catalog.csv',
        channel: null,
        review_payload: {
          filename: filename ?? null,
          header,
          sample_rows,
          mappings: mappings.map((m) => ({
            raw: String(m.raw ?? ''),
            proposed: allowedKeys.has(String(m.proposed)) ? String(m.proposed) : 'ignore',
            reasoning: String(m.reasoning ?? ''),
            confidence: typeof m.confidence === 'number' ? m.confidence : 0.5,
          })),
        },
        status: 'pending',
      },
      select: { id: true, review_payload: true, status: true, created_at: true },
    })

    return NextResponse.json({ record_id: record.id, created_at: record.created_at, review: record.review_payload })
  } catch (error) {
    console.error('catalog-mapping error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Catalog mapping failed' },
      { status: 500 },
    )
  }
}
