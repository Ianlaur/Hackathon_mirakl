'use client'

import { useEffect } from 'react'

type Parcel = {
  id: string
  type: 'incoming' | 'outgoing'
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'cancelled'
  tracking_code: string | null
  carrier: string | null
  carrier_url: string | null
  reference: string | null
  sender_name: string | null
  sender_address: string | null
  recipient_name: string | null
  recipient_address: string | null
  weight: number | null
  description: string | null
  notes: string | null
  estimated_date: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

type ParcelDetailedViewProps = {
  parcel: Parcel
  onClose: () => void
}

export default function ParcelDetailedView({ parcel, onClose }: ParcelDetailedViewProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Parcel details</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {parcel.reference || parcel.tracking_code || 'Parcel overview'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close parcel details"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
          <DetailBlock label="Type" value={parcel.type === 'incoming' ? 'Incoming' : 'Outgoing'} />
          <DetailBlock label="Status" value={parcel.status.replaceAll('_', ' ')} />
          <DetailBlock label="Tracking code" value={parcel.tracking_code} />
          <DetailBlock label="Carrier" value={parcel.carrier} />
          <DetailBlock label="Sender" value={parcel.sender_name} />
          <DetailBlock label="Recipient" value={parcel.recipient_name} />
          <DetailBlock label="Sender address" value={parcel.sender_address} />
          <DetailBlock label="Recipient address" value={parcel.recipient_address} />
          <DetailBlock label="Estimated date" value={parcel.estimated_date} />
          <DetailBlock label="Delivered at" value={parcel.delivered_at} />
          <DetailBlock label="Description" value={parcel.description} />
          <DetailBlock label="Notes" value={parcel.notes} />
        </div>
      </div>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900">{value || 'Not provided'}</p>
    </div>
  )
}
