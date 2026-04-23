'use client'

// MIRA — F1 Flash Onboarding (catalog review).
// Founder uploads a supplier CSV, MIRA (GPT-4o) maps columns to Mirakl
// taxonomies, founder approves / modifies / rejects each mapping.
// Spec invariant: the mapping reasoning lives in catalog_review_records,
// NEVER in decision_ledger.

import { useCallback, useState } from 'react'
import { Upload, Check, X, FileSpreadsheet } from 'lucide-react'
import { SimulatedBadge } from '@/components/SimulatedBadge'

type Mapping = {
  raw: string
  proposed: string
  reasoning: string
  confidence: number
}

type ReviewPayload = {
  filename: string | null
  header: string[]
  sample_rows: string[][]
  mappings: Mapping[]
}

const MIRAKL_OPTIONS = [
  'sku',
  'name',
  'description',
  'category',
  'brand',
  'price_eur',
  'stock',
  'weight_grams',
  'ean',
  'image_url',
  'ignore',
] as const

export default function CatalogPage() {
  const [filename, setFilename] = useState<string | null>(null)
  const [header, setHeader] = useState<string[]>([])
  const [sampleRows, setSampleRows] = useState<string[][]>([])
  const [review, setReview] = useState<ReviewPayload | null>(null)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recordStatus, setRecordStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setReview(null)
    setRecordId(null)
    setFilename(file.name)
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      setError("CSV trop court — au moins une ligne d'en-tête + une ligne de données.")
      return
    }
    const headRaw = splitCsvLine(lines[0])
    const previewRaw = lines.slice(1, 4).map(splitCsvLine)
    setHeader(headRaw)
    setSampleRows(previewRaw)
  }, [])

  const analyse = useCallback(async () => {
    if (header.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/mira/catalog-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, header, sample_rows: sampleRows }),
      })
      const body = await resp.json()
      if (!resp.ok) throw new Error(body?.error ?? `HTTP ${resp.status}`)
      setReview(body.review as ReviewPayload)
      setRecordId(body.record_id as string)
      setRecordStatus('pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'analyse échouée')
    } finally {
      setLoading(false)
    }
  }, [filename, header, sampleRows])

  const updateMapping = (idx: number, proposed: string) => {
    if (!review) return
    const next = { ...review, mappings: review.mappings.slice() }
    next.mappings[idx] = { ...next.mappings[idx], proposed }
    setReview(next)
  }

  const resolve = async (status: 'approved' | 'rejected') => {
    if (!recordId) return
    try {
      await fetch(`/api/mira/catalog-mapping/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setRecordStatus(status)
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="space-y-4">
      <header className="mira-card mira-card--raised flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <div className="mira-label">Plugin</div>
          <h1 className="mira-display text-[22px] font-bold">Flash Onboarding</h1>
          <p className="mt-1 text-xs text-slate-600">
            Dépose un CSV fournisseur. MIRA mappe les colonnes aux champs Mirakl — tu valides.
          </p>
        </div>
        <SimulatedBadge label="CSV → MIRAKL" />
      </header>

      <section className="mira-card mira-card--raised p-5">
        <div className="flex items-center gap-3">
          <label className="mira-button inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
            <Upload className="h-4 w-4" />
            Choisir un CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
          </label>
          {filename ? (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-[color:var(--mira-blue)]" />
              <span className="font-semibold">{filename}</span>
              <span className="text-xs text-slate-500">
                ({header.length} colonnes · {sampleRows.length} lignes aperçues)
              </span>
            </div>
          ) : null}
          <button
            onClick={analyse}
            disabled={loading || header.length === 0}
            className="ml-auto rounded-md bg-[color:var(--mira-blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Analyse…' : 'Analyser avec MIRA'}
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-[color:var(--mira-pink)]">{error}</p> : null}
      </section>

      {header.length > 0 ? (
        <section className="mira-card mira-card--raised p-5">
          <div className="mira-label mb-2">Aperçu brut</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  {header.map((h) => (
                    <th key={h} className="px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, i) => (
                  <tr key={i} className="border-t border-[color:var(--mira-border)]">
                    {row.map((cell, j) => (
                      <td key={j} className="max-w-[200px] truncate px-2 py-1 text-slate-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {review ? (
        <section className="mira-card mira-card--raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="mira-label">Mapping proposé par MIRA</div>
              <h2 className="mira-display text-[16px] font-bold">{review.mappings.length} colonnes analysées</h2>
            </div>
            <div className="flex items-center gap-2">
              {recordStatus === 'pending' ? (
                <>
                  <button
                    onClick={() => resolve('rejected')}
                    className="mira-button inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    Rejeter
                  </button>
                  <button
                    onClick={() => resolve('approved')}
                    className="rounded-md bg-[color:var(--mira-blue)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Approuver le mapping
                    </span>
                  </button>
                </>
              ) : (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    recordStatus === 'approved'
                      ? 'bg-[color:var(--mira-blue-soft)] text-[color:var(--mira-blue)]'
                      : 'bg-[color:var(--mira-pink-soft)] text-[color:var(--mira-pink)]'
                  }`}
                >
                  {recordStatus === 'approved' ? 'Approuvé' : 'Rejeté'}
                </span>
              )}
            </div>
          </div>
          <ul className="space-y-2">
            {review.mappings.map((m, i) => (
              <li key={`${m.raw}-${i}`} className="mira-card p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,180px)_1fr_auto]">
                  <div>
                    <div className="mira-label">Colonne brute</div>
                    <div className="truncate text-sm font-semibold text-[color:var(--mira-ink)]">{m.raw}</div>
                  </div>
                  <div>
                    <div className="mira-label">Champ Mirakl</div>
                    <select
                      value={m.proposed}
                      onChange={(e) => updateMapping(i, e.target.value)}
                      disabled={recordStatus !== 'pending'}
                      className="mt-0.5 w-full rounded-md border border-[color:var(--mira-border)] bg-white px-2 py-1 text-sm"
                    >
                      {MIRAKL_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mira-label">Raisonnement MIRA</div>
                    <p className="text-xs text-slate-700">{m.reasoning}</p>
                  </div>
                  <div className="text-right">
                    <div className="mira-label">Confiance</div>
                    <div className="mira-display text-[14px] font-bold text-[color:var(--mira-blue)]">
                      {Math.round((m.confidence ?? 0) * 100)}%
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

// Minimal CSV splitter — handles quoted fields with commas inside. Good enough
// for supplier CSVs we've encountered. If you need RFC 4180 completeness,
// swap for papaparse later.
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQuote = false
      } else {
        cur += c
      }
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') {
        cells.push(cur)
        cur = ''
      } else {
        cur += c
      }
    }
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}
