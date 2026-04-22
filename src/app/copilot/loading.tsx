export default function CopilotLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <div className="space-y-5 animate-pulse">
        <div className="h-16 w-80 rounded-lg bg-slate-200" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
          <div className="h-36 rounded-2xl border border-slate-200 bg-white md:col-span-2" />
          <div className="h-36 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-36 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-36 rounded-2xl border border-slate-200 bg-white" />
        </div>

        <div className="h-[320px] rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  )
}
