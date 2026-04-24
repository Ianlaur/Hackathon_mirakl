export type RecentOrderRowStatus = 'fulfilled' | 'processing' | 'risk_attached'
export type RecentOrderWindowBucket = 'in_transit' | 'delivered_24h' | 'processing'

function normalizeSource(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function deriveRecentOrderRowStatus(
  financialStatus: string | null | undefined,
  fulfillmentStatus: string | null | undefined
): RecentOrderRowStatus {
  const financial = normalizeSource(financialStatus)
  const fulfillment = normalizeSource(fulfillmentStatus)

  if (financial === 'pending') return 'risk_attached'
  if (fulfillment === 'fulfilled' || fulfillment === 'delivered' || fulfillment === 'shipped') {
    return 'fulfilled'
  }

  return 'processing'
}

export function deriveRecentOrderWindowBucket(
  fulfillmentStatus: string | null | undefined
): RecentOrderWindowBucket {
  const fulfillment = normalizeSource(fulfillmentStatus)

  if (fulfillment === 'shipped') return 'in_transit'
  if (fulfillment === 'fulfilled' || fulfillment === 'delivered') return 'delivered_24h'
  return 'processing'
}

export function buildMarketplacePresentation(
  shopName: string | null | undefined,
  shopDomain: string | null | undefined
) {
  const label = (shopName || shopDomain || 'Shopify').trim()
  const compact = label.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const code = (compact.slice(0, 3) || 'SHP').padEnd(3, 'X')

  return { label, code }
}

export function matchesMarketplaceFilter(
  filters: string[] | null,
  shopName: string | null | undefined,
  shopDomain: string | null | undefined
) {
  if (!filters || filters.length === 0) return true

  const haystack = `${normalizeSource(shopName)} ${normalizeSource(shopDomain)}`
  return filters.some((filter) => haystack.includes(normalizeSource(filter)))
}
