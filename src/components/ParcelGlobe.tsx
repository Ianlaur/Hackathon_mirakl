'use client'

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

type ParcelGlobeProps = {
  parcels: Parcel[]
  selectedParcel: Parcel | null
  onParcelSelect: (parcel: Parcel) => void
  height?: number
  showControls?: boolean
}

const statusTone: Record<Parcel['status'], string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_transit: 'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  returned: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-600',
}

export default function ParcelGlobe({
  parcels,
  selectedParcel,
  onParcelSelect,
  height = 600,
  showControls = true,
}: ParcelGlobeProps) {
  const incomingCount = parcels.filter((parcel) => parcel.type === 'incoming').length
  const outgoingCount = parcels.length - incomingCount

  return (
    <section
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      style={{ minHeight: height }}
    >
      <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_45%),linear-gradient(180deg,#0f172a_0%,#1e293b_100%)] p-6 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Logistics network</p>
            <h2 className="text-3xl font-semibold tracking-tight">Parcel overview</h2>
            <p className="text-sm leading-6 text-slate-300">
              The original 3D globe component is missing from this repository, so this view falls back to an operational
              network panel that keeps parcel selection working.
            </p>
          </div>

          {showControls && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label="Total" value={parcels.length} />
              <MetricCard label="Incoming" value={incomingCount} />
              <MetricCard label="Outgoing" value={outgoingCount} />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_50%,#eef2ff_100%)] p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {parcels.map((parcel) => {
              const isSelected = selectedParcel?.id === parcel.id

              return (
                <button
                  key={parcel.id}
                  type="button"
                  onClick={() => onParcelSelect(parcel)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-blue-500 bg-white shadow-md ring-2 ring-blue-200'
                      : 'border-white/70 bg-white/80 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {parcel.reference || parcel.tracking_code || 'Parcel without reference'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {parcel.type === 'incoming' ? 'Incoming' : 'Outgoing'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[parcel.status]}`}>
                      {parcel.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-700">From:</span> {parcel.sender_name || 'Unknown sender'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">To:</span> {parcel.recipient_name || 'Unknown recipient'}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">Carrier:</span> {parcel.carrier || 'Not assigned'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Selection</h3>
          {selectedParcel ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Tracking</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {selectedParcel.tracking_code || 'No tracking code'}
                </p>
              </div>
              <InfoRow label="Reference" value={selectedParcel.reference} />
              <InfoRow label="Sender" value={selectedParcel.sender_name} />
              <InfoRow label="Recipient" value={selectedParcel.recipient_name} />
              <InfoRow label="Carrier" value={selectedParcel.carrier} />
              <InfoRow label="Description" value={selectedParcel.description} />
              <InfoRow label="Notes" value={selectedParcel.notes} />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Select a parcel card to inspect its details. This keeps the globe workflow usable until the missing visual
              component is restored.
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value || 'Not provided'}</p>
    </div>
  )
}
