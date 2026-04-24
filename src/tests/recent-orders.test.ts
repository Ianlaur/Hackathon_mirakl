import { describe, expect, it } from 'vitest'
import {
  buildMarketplacePresentation,
  deriveRecentOrderRowStatus,
  deriveRecentOrderWindowBucket,
} from '@/lib/recent-orders'

describe('deriveRecentOrderRowStatus', () => {
  it('marks pending payment orders as risk attached', () => {
    expect(deriveRecentOrderRowStatus('pending', null)).toBe('risk_attached')
  })

  it('marks fulfilled orders as fulfilled', () => {
    expect(deriveRecentOrderRowStatus('paid', 'fulfilled')).toBe('fulfilled')
  })

  it('keeps all other orders in processing', () => {
    expect(deriveRecentOrderRowStatus('paid', null)).toBe('processing')
  })
})

describe('deriveRecentOrderWindowBucket', () => {
  it('counts shipped orders as in transit', () => {
    expect(deriveRecentOrderWindowBucket('shipped')).toBe('in_transit')
  })

  it('counts delivered orders as delivered_24h', () => {
    expect(deriveRecentOrderWindowBucket('delivered')).toBe('delivered_24h')
  })
})

describe('buildMarketplacePresentation', () => {
  it('prefers the merchant shop name when available', () => {
    expect(buildMarketplacePresentation('Nordika Paris', 'nordika-paris.myshopify.com')).toEqual({
      label: 'Nordika Paris',
      code: 'NOR',
    })
  })
})
