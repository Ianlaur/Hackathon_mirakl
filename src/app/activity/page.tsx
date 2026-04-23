import { CalendarClock, CheckCircle2, ClipboardList, CircleDot } from 'lucide-react'

const activityRows = [
  ['#ORDER-884', 'Label generated', 'Processing'],
  ['#ORDER-880', 'Delivery confirmed', 'Handled'],
  ['#ORDER-876', 'ETA refreshed', 'In Transit'],
  ['#ORDER-871', 'Stock reconciled', 'Handled'],
]

const handledRows = [
  ['SKU-PIN-03', 'Stock healthy'],
  ['SKU-BIR-02', 'Threshold closed'],
  ['PAR-118', 'Exception archived'],
]

const upcomingRows = [
  ['May', 'Catalogue', 'Stock'],
  ['Jun', 'Capacity', 'Ops'],
  ['Jul', 'Policy', 'Risk'],
  ['Aug', 'Holiday', 'Buffer'],
  ['Sep', 'Peak prep', 'Forecast'],
  ['Oct', 'Audit', 'Ledger'],
]

function ActivityCard({
  title,
  eyebrow,
  children,
  className = '',
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`mira-card p-5 ${className}`}>
      <p className="mira-label">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold text-[#03182F]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function HorizontalTimeline() {
  return (
    <div className="overflow-x-auto pb-2">
      <div aria-label="Six-month timeline track" className="relative min-w-[760px] px-2 py-8">
        <div className="absolute left-10 right-10 top-1/2 h-0.5 -translate-y-1/2 bg-[#03182F]/10" />
        <div className="grid grid-cols-6 gap-5">
          {upcomingRows.map(([month, label, type], index) => (
            <div key={month} className="relative flex flex-col items-center text-center">
              <div
                className={`z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFFFFF] shadow-sm ${
                  index === 0 ? 'text-[#F22E75]' : 'text-[#2764FF]'
                }`}
              >
                {index === 0 ? <CalendarClock className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
              </div>
              <p className="mt-3 font-mono text-xs font-bold text-[#2764FF]">{month}</p>
              <p className="mt-1 text-sm font-semibold text-[#03182F]">{label}</p>
              <span className="mt-2 rounded-md bg-[#F2F8FF] px-2 py-1 text-[11px] font-bold text-[#03182F]/55">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ActivityPage() {
  return (
    <div className="mx-auto w-full max-w-7xl pb-24">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mira-label">Tertiary Workspace</p>
          <h1 className="mira-display mt-2 text-5xl font-bold text-[#03182F]">Activity</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#03182F]/55">
            <span className="rounded-md bg-[#FFFFFF] px-2.5 py-1 shadow-sm">Logs</span>
            <span className="rounded-md bg-[#FFFFFF] px-2.5 py-1 shadow-sm">Handled</span>
            <span className="rounded-md bg-[#FFFFFF] px-2.5 py-1 shadow-sm">Horizon</span>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[#2764FF]/10 px-3 py-2 text-xs font-bold text-[#2764FF]">
          <ClipboardList className="h-4 w-4" />
          Plugin layer
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <ActivityCard eyebrow="Raw Activity" title="Order archive">
          <div className="space-y-2">
            {activityRows.map(([id, label, status]) => (
              <div key={id} className="rounded-md bg-[#F2F8FF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-bold text-[#2764FF]">{id}</span>
                  <span className="rounded-md bg-[#03182F]/5 px-2 py-1 text-xs font-bold text-[#03182F]/65">{status}</span>
                </div>
                <p className="mt-2 text-sm text-[#03182F]/75">{label}</p>
              </div>
            ))}
          </div>
        </ActivityCard>

        <ActivityCard eyebrow="Recently Handled" title="Closed by Mira">
          <div className="space-y-2">
            {handledRows.map(([id, label]) => (
              <div key={id} className="rounded-md bg-[#F2F8FF] p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2764FF]" />
                  <span className="font-mono text-xs font-bold text-[#2764FF]">{id}</span>
                </div>
                <p className="mt-2 text-sm text-[#03182F]/75">{label}</p>
              </div>
            ))}
          </div>
        </ActivityCard>

        <ActivityCard eyebrow="Upcoming Events" title="Six-month track" className="lg:col-span-2">
          <HorizontalTimeline />
        </ActivityCard>
      </div>
    </div>
  )
}
