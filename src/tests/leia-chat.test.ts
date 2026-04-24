import { describe, expect, it } from 'vitest'
import {
  buildLeiaSystemPrompt,
  detectConversationLanguage,
  extractRecommendationIds,
} from '@/lib/leia-chat'

describe('detectConversationLanguage', () => {
  it('detects French messages', () => {
    expect(detectConversationLanguage("Quel est mon stock aujourd'hui ?")).toBe('fr')
  })

  it('detects English messages', () => {
    expect(detectConversationLanguage('What is my stock today?')).toBe('en')
  })
})

describe('buildLeiaSystemPrompt', () => {
  it('builds a French prompt when the conversation is French', () => {
    const prompt = buildLeiaSystemPrompt({ language: 'fr' })

    expect(prompt).toContain('Tu es LEIA')
    expect(prompt).toContain('Réponds en français')
    expect(prompt).toContain('confirmed=true')
    expect(prompt).not.toContain('Respond in English')
  })

  it('builds an English prompt when the conversation is English', () => {
    const prompt = buildLeiaSystemPrompt({ language: 'en' })

    expect(prompt).toContain('You are LEIA')
    expect(prompt).toContain('Respond in English')
    expect(prompt).toContain('confirmed=true')
    expect(prompt).not.toContain('Réponds en français')
  })
})

describe('extractRecommendationIds', () => {
  it('returns recommendation ids created by tool calls', () => {
    const recommendationIds = extractRecommendationIds([
      {
        name: 'propose_restock_plan',
        args: { horizon_days: 30 },
        result: { ok: true, created: true, recommendation_id: 'reco-123' },
      },
      {
        name: 'get_stock_summary',
        args: {},
        result: { total_products: 200 },
      },
    ])

    expect(recommendationIds).toEqual(['reco-123'])
  })
})
