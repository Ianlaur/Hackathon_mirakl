export type LeiaQuickPrompt = {
  label: string
  message: string
}

export const LEIA_QUICK_PROMPTS: LeiaQuickPrompt[] = [
  {
    label: 'Stock summary',
    message: 'What is my stock position today?',
  },
  {
    label: 'Pending actions',
    message: 'What actions are pending?',
  },
  {
    label: 'Restock plan',
    message: 'Prepare a replenishment plan for critical products.',
  },
  {
    label: 'Leave planning',
    message: 'I will be on vacation from 2026-06-10 to 2026-06-15.',
  },
]
