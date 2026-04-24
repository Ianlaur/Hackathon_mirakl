export function SimulatedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#FFE7EC] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#F22E75] ${className}`}
    >
      SIMULATED
    </span>
  )
}
