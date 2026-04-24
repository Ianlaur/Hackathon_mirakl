import { describe, expect, it } from 'vitest'
import { LEIA_QUICK_PROMPTS } from '@/lib/leia-prompts'

describe('LEIA_QUICK_PROMPTS', () => {
  it('provides clickable starter prompts for empty chat states', () => {
    expect(LEIA_QUICK_PROMPTS.length).toBeGreaterThanOrEqual(4)
    expect(LEIA_QUICK_PROMPTS[0]).toHaveProperty('label')
    expect(LEIA_QUICK_PROMPTS[0]).toHaveProperty('message')
  })

  it('uses unique labels so chips stay unambiguous', () => {
    const labels = LEIA_QUICK_PROMPTS.map((prompt) => prompt.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
