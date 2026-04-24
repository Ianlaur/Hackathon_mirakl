'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, FileUp, Loader2, Pencil, RefreshCw, Send, X } from 'lucide-react'

type CatalogReviewRecord = {
  id: string
  sku: string
  channel: string | null
  status: string
  row_index: number
  source_column: string | null
  target_field: string
  raw_value: string
  proposed_value: string
  reasoning: string
  confidence: number
  simulated: boolean
  created_at: string
}

function statusClass(status: string) {
  if (status === 'approved') return 'bg-[#3FA46A]/10 text-emerald-700'
  if (status === 'modified') return 'bg-[#2764FF]/10 text-[#2764FF]'
  if (status === 'rejected') return 'bg-[#FFE7EC] text-[#F22E75]'
  return 'bg-[#E0A93A]/10 text-amber-700'
}

export default function CatalogPageClient() {
  const [records, setRecords] = useState<CatalogReviewRecord[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})

  const pendingHighConfidence = useMemo(
    () => records.filter((record) => record.status === 'pending' && record.confidence >= 0.85),
    [records]
  )

  const approvedCount = useMemo(
    () => records.filter((record) => record.status === 'approved' || record.status === 'modified').length,
    [records]
  )

  const loadExisting = async () => {
    setLoadingExisting(true)
    try {
      const resp = await fetch('/api/catalog-mapping', { cache: 'no-store' })
      const data = await resp.json()
      if (resp.ok && Array.isArray(data.records)) setRecords(data.records)
    } finally {
      setLoadingExisting(false)
    }
  }

  useEffect(() => {
    loadExisting()
  }, [])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError(null)
    setFileName(file.name)

    try {
      const csv = await file.text()
      const resp = await fetch('/api/catalog-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, csv, channel: 'mirakl' }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error ?? 'Catalog analysis failed')
      setRecords(data.records ?? [])
      setDraftValues({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Catalog upload failed')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const patchRecord = async (
    id: string,
    payload: { status: 'approved' | 'modified' | 'rejected'; proposed_value?: string }
  ) => {
    const resp = await fetch(`/api/catalog-mapping/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error ?? 'Update failed')
    setRecords((current) =>
      current.map((record) => (record.id === id ? (data.record as CatalogReviewRecord) : record))
    )
  }

  const approveHighConfidence = async () => {
    setBusy(true)
    setError(null)
    try {
      await Promise.all(
        pendingHighConfidence.map((record) =>
          patchRecord(record.id, { status: 'approved', proposed_value: record.proposed_value })
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk approval failed')
    } finally {
      setBusy(false)
    }
  }

  const updateOne = async (
    record: CatalogReviewRecord,
    status: 'approved' | 'modified' | 'rejected'
  ) => {
    setError(null)
    try {
      await patchRecord(record.id, {
        status,
        proposed_value: status === 'modified' ? draftValues[record.id] ?? record.proposed_value : record.proposed_value,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-[#F2F8FF]/35">
      <div className="flex h-full flex-col">
        <header className="border-b border-[#DDE5EE] bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-[22px] font-bold leading-8 text-[#03182F]">Catalog</h1>
              <p className="font-serif text-[14px] leading-6 text-[#6B7480]">
                Review CSV mappings into the Mirakl 11-field taxonomy before any simulated push.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FFE7EC] px-3 py-1 text-[11px] font-bold text-[#F22E75]">
                SIMULATED Mirakl push
              </span>
              <button
                type="button"
                onClick={loadExisting}
                disabled={loadingExisting}
                className="inline-flex h-9 items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 text-[13px] font-bold text-[#30373E] hover:bg-[#F2F8FF] disabled:opacity-60"
              >
                {loadingExisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded bg-[#2764FF] px-3 text-[13px] font-bold text-white hover:bg-[#004bd9]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Upload CSV
                <input type="file" accept=".csv,text/csv" onChange={handleUpload} className="hidden" />
              </label>
            </div>
          </div>
          {fileName ? (
            <p className="mt-2 font-serif text-[12px] text-[#6B7480]">Current file: {fileName}</p>
          ) : null}
          {error ? (
            <p className="mt-2 inline-flex rounded-lg border border-[#F22E75]/25 bg-[#FFE7EC] px-3 py-1.5 font-serif text-[12px] text-[#03182F]">
              {error}
            </p>
          ) : null}
        </header>

        <section className="border-b border-[#DDE5EE] bg-white px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 font-serif text-[12px] text-[#6B7480]">
              <span className="rounded-full border border-[#DDE5EE] px-3 py-1">{records.length} mappings</span>
              <span className="rounded-full border border-[#DDE5EE] px-3 py-1">{approvedCount} approved or modified</span>
              <span className="rounded-full border border-[#DDE5EE] px-3 py-1">{pendingHighConfidence.length} high confidence</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={approveHighConfidence}
                disabled={busy || pendingHighConfidence.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 text-[13px] font-bold text-[#30373E] hover:bg-[#F2F8FF] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Bulk approve high confidence
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded bg-[#03182F] px-3 text-[13px] font-bold text-white opacity-80"
                title="Simulation only"
              >
                <Send className="h-4 w-4" />
                Push to Mirakl SIMULATED
              </button>
            </div>
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#BFCBDA] bg-white p-8 text-center">
              <FileUp className="mx-auto h-10 w-10 text-[#6B7480]" />
              <p className="mt-3 font-serif text-[15px] font-bold text-[#03182F]">
                Upload a supplier CSV to start review.
              </p>
              <p className="mt-1 font-serif text-[13px] text-[#6B7480]">
                Leia will produce one review record per Mirakl taxonomy field.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#DDE5EE] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-[#F2F8FF] text-[10px] uppercase tracking-[0.1em] text-[#6B7480]">
                  <tr>
                    <th className="p-3 text-left">SKU</th>
                    <th className="p-3 text-left">Mirakl field</th>
                    <th className="p-3 text-left">Raw value</th>
                    <th className="p-3 text-left">Proposed value</th>
                    <th className="p-3 text-left">Reasoning</th>
                    <th className="p-3 text-left">Confidence</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE5EE]">
                  {records.map((record) => (
                    <tr key={record.id} className="align-top hover:bg-[#F2F8FF]/45">
                      <td className="p-3 font-mono text-xs text-[#30373E]">{record.sku}</td>
                      <td className="p-3 font-mono text-xs font-semibold text-[#03182F]">
                        {record.target_field}
                        {record.simulated ? (
                          <span className="ml-2 rounded bg-[#FFE7EC] px-1.5 py-0.5 font-sans text-[10px] font-bold text-[#F22E75]">
                            SIMULATED
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[180px] p-3 font-serif text-[12px] text-[#30373E]">
                        {record.raw_value || '—'}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={draftValues[record.id] ?? record.proposed_value}
                          onChange={(event) =>
                            setDraftValues((current) => ({
                              ...current,
                              [record.id]: event.target.value,
                            }))
                          }
                          className="h-9 w-full rounded border border-[#DDE5EE] bg-white px-2 font-serif text-[12px] text-[#03182F] outline-none focus:border-[#2764FF] focus:ring-1 focus:ring-[#2764FF]"
                        />
                      </td>
                      <td className="max-w-[260px] p-3 font-serif text-[12px] leading-5 text-[#6B7480]">
                        {record.reasoning}
                      </td>
                      <td className="p-3 font-mono text-xs text-[#30373E]">
                        {Math.round(record.confidence * 100)}%
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => updateOne(record, 'approved')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#DDE5EE] bg-white text-[#3FA46A] hover:bg-[#3FA46A]/10"
                            aria-label="Approve mapping"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOne(record, 'modified')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#DDE5EE] bg-white text-[#2764FF] hover:bg-[#2764FF]/10"
                            aria-label="Save modified mapping"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOne(record, 'rejected')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#DDE5EE] bg-white text-[#F22E75] hover:bg-[#FFE7EC]"
                            aria-label="Reject mapping"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
