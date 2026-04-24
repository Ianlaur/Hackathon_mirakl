export type LeiaQuickPrompt = {
  label: string
  message: string
}

export const LEIA_QUICK_PROMPTS: LeiaQuickPrompt[] = [
  {
    label: 'Stock summary',
    message: "Quel est mon stock aujourd'hui ?",
  },
  {
    label: 'Pending actions',
    message: 'Quelles sont mes actions en attente ?',
  },
  {
    label: 'Restock plan',
    message: 'Prépare un plan de réapprovisionnement pour les produits critiques.',
  },
  {
    label: 'Leave planning',
    message: 'Je vais partir en vacances du 2026-06-10 au 2026-06-15.',
  },
]
