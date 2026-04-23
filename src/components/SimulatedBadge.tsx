// MIRA — demo-honesty badge. Spec: "mock at the edges, never at the core.
// Every mock must be labeled SIMULÉ in the UI with a small pink badge."
// Use wherever a mocked integration fires (Amazon/Google write-back, supplier
// emails, carrier API, notifications).

type Size = 'xs' | 'sm'

export function SimulatedBadge({ label = 'SIMULÉ', size = 'xs', title }: { label?: string; size?: Size; title?: string }) {
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]'
  return (
    <span
      title={title ?? 'Intégration mockée pour la démo — aucune écriture réelle.'}
      className={`inline-flex items-center gap-1 rounded-md bg-[color:var(--mira-pink-soft)] font-bold uppercase tracking-wider text-[color:var(--mira-pink)] ${padding}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--mira-pink)]" />
      {label}
    </span>
  )
}

export default SimulatedBadge
