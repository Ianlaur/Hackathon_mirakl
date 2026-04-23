export default function SimulatedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[#FFE7EC] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#F22E75] ${className}`}
      title="Donnée simulée — pas encore connectée à la source réelle"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#F22E75]" />
      SIMULÉ
    </span>
  )
}
