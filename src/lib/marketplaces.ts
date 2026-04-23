export type ConnectedMarketplace = {
  name: string
  revenue: string
  change: string
  status: 'STABLE' | 'REVIEW' | 'PENDING'
  icon: string
}

export type MarketplaceProposal = {
  name: string
  category: string
  dailyUsers: string
  revenue: string
}

export type MarketplaceSuggestion = {
  name: string
  desc: string
}

export const INITIAL_CONNECTED_MARKETPLACES: ConnectedMarketplace[] = [
  { name: 'Amazon', revenue: '€42,000', change: '+12.4%', status: 'STABLE', icon: 'AMZ' },
  { name: 'Rakuten', revenue: '€28,500', change: '+5.1%', status: 'STABLE', icon: 'RKT' },
  { name: 'Cdiscount', revenue: '€14,200', change: '-2.4%', status: 'REVIEW', icon: 'CDS' },
  { name: 'Leroy Merlin', revenue: '€31,800', change: '+18.2%', status: 'STABLE', icon: 'LRY' },
]

export const INITIAL_MARKETPLACE_PROPOSALS: MarketplaceProposal[] = [
  { name: 'Darty', category: 'Electronics & Home', dailyUsers: '2.4M', revenue: '€850M' },
  { name: 'Carrefour', category: 'Retail Giant', dailyUsers: '4.8M', revenue: '€1.2B' },
  { name: 'Auchan', category: 'Hypermarket Chain', dailyUsers: '3.1M', revenue: '€920M' },
  { name: 'ManoMano', category: 'DIY & Garden', dailyUsers: '1.8M', revenue: '€540M' },
]

export const MARKETPLACE_SUGGESTIONS: MarketplaceSuggestion[] = [
  { name: 'Vente-privee', desc: 'Ideal for clearance of high-end furniture stock.' },
  { name: 'Wayfair', desc: 'Strong alignment with your upholstery product category.' },
  { name: 'Home24', desc: 'Growth opportunity in the DACH furniture market.' },
]

export const MARKETPLACE_CONVERSATIONS = ['Darty', 'Carrefour', 'Auchan', 'ManoMano']

export function buildActiveConnectionHref(partner: string) {
  return `/marketplaces/active-connection?partner=${encodeURIComponent(partner)}`
}

export function pickConversationName(partner: string | null, availablePartners: string[]) {
  if (partner && availablePartners.includes(partner)) {
    return partner
  }

  return availablePartners[0] ?? ''
}

export function declineMarketplaceProposal(
  proposals: MarketplaceProposal[],
  partnerName: string
): MarketplaceProposal[] {
  return proposals.filter((proposal) => proposal.name !== partnerName)
}

export function acceptMarketplaceProposal(
  proposals: MarketplaceProposal[],
  connected: ConnectedMarketplace[],
  partnerName: string
): { proposals: MarketplaceProposal[]; connected: ConnectedMarketplace[] } {
  const remainingProposals = declineMarketplaceProposal(proposals, partnerName)
  const exists = connected.some((channel) => channel.name === partnerName)

  if (exists) {
    return {
      proposals: remainingProposals,
      connected,
    }
  }

  return {
    proposals: remainingProposals,
    connected: [
      ...connected,
      {
        name: partnerName,
        revenue: 'Pending sync',
        change: 'New',
        status: 'PENDING' as const,
        icon: partnerName.slice(0, 3).toUpperCase(),
      },
    ],
  }
}

export function addMarketplaceSuggestion(
  proposals: MarketplaceProposal[],
  suggestion: MarketplaceSuggestion
): MarketplaceProposal[] {
  if (proposals.some((proposal) => proposal.name === suggestion.name)) {
    return proposals
  }

  return [
    ...proposals,
    {
      name: suggestion.name,
      category: 'Suggested match',
      dailyUsers: 'Opportunity',
      revenue: 'Pending review',
    },
  ]
}
