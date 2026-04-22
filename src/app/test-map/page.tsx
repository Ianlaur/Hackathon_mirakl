import dynamic from 'next/dynamic'

const GlobalShipmentTracker = dynamic(
  () => import('@/components/map/GlobalShipmentTracker'),
  {
    ssr: false,
    loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-slate-900/80" />,
  }
)

export default function TestMapPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Global Shipment Tracker Sandbox</h1>
      <GlobalShipmentTracker height={420} />
    </div>
  )
}
