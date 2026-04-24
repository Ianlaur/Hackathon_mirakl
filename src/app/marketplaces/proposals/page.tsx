'use client'

import { useRef, useState } from 'react'
import { ArrowRight, Check, Mail, Store, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  type ConnectedMarketplace,
  acceptMarketplaceProposal,
  addMarketplaceSuggestion,
  buildActiveConnectionHref,
  declineMarketplaceProposal,
  INITIAL_CONNECTED_MARKETPLACES,
  INITIAL_MARKETPLACE_PROPOSALS,
  type MarketplaceProposal,
  MARKETPLACE_SUGGESTIONS,
} from '@/lib/marketplaces'

export default function IntegrationProposalsPage() {
  const router = useRouter()
  const proposalsRef = useRef<HTMLElement>(null)
  const [connectedMarketplaces, setConnectedMarketplaces] = useState<ConnectedMarketplace[]>(
    INITIAL_CONNECTED_MARKETPLACES
  )
  const [proposals, setProposals] = useState<MarketplaceProposal[]>(
    INITIAL_MARKETPLACE_PROPOSALS
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handleAccept = (partnerName: string) => {
    const next = acceptMarketplaceProposal(proposals, connectedMarketplaces, partnerName)
    setProposals(next.proposals)
    setConnectedMarketplaces(next.connected)
    setStatusMessage(`${partnerName} moved to active channels.`)
  }

  const handleDecline = (partnerName: string) => {
    setProposals((current) => declineMarketplaceProposal(current, partnerName))
    setStatusMessage(`${partnerName} removed from the proposal queue.`)
  }

  const handleMessage = (partnerName: string) => {
    router.push(buildActiveConnectionHref(partnerName))
  }

  const handleExplore = (suggestion: (typeof MARKETPLACE_SUGGESTIONS)[number]) => {
    setProposals((current) => addMarketplaceSuggestion(current, suggestion))
    setStatusMessage(`${suggestion.name} added to proposals.`)
    proposalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Integration Proposals</h1>
          <p className="text-[#6B7480] text-sm mt-1">Review new channels and move qualified partners into activation.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/marketplaces/active-connection')}
          className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-semibold rounded transition-all duration-150 ease-out hover:bg-[#004bd9]/90 focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 flex items-center gap-2"
        >
          <span className="text-sm">+</span> New Channel
        </button>
      </div>

      {statusMessage ? (
        <div className="rounded-lg border border-[#DDE5EE] bg-[#F2F8FF] px-4 py-3 text-[13px] text-[#30373E]">
          {statusMessage}
        </div>
      ) : null}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Connected Marketplaces</h3>
          <span className="font-mono text-[10px] text-[#2764FF] font-bold">{connectedMarketplaces.length} ACTIVE CHANNELS</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {connectedMarketplaces.map((marketplace) => {
            const negative = marketplace.change.startsWith('-')
            const badgeClass =
              marketplace.status === 'STABLE'
                ? 'bg-[#3FA46A]/10 text-[#3FA46A]'
                : marketplace.status === 'PENDING'
                  ? 'bg-[#2764FF]/10 text-[#2764FF]'
                  : 'bg-[#FFE7EC] text-[#F22E75]'

            return (
              <div
                key={marketplace.name}
                className="bg-white border border-[#DDE5EE] p-5 rounded transition-all duration-150 ease-out hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-[#DDE5EE] text-[11px] font-bold text-[#03182F]">
                    {marketplace.icon}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeClass}`}>
                    {marketplace.status}
                  </span>
                </div>
                <h4 className="font-serif text-base font-bold text-[#03182F]">{marketplace.name}</h4>
                <p className="text-[12px] text-[#6B7480]">Revenue Generated</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-[22px] font-bold text-[#03182F]">{marketplace.revenue}</span>
                  <span className={`font-mono text-[10px] ${negative ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`}>
                    {marketplace.change}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-[#F2F8FF] flex justify-between items-center">
                  <svg
                    className={`w-24 h-6 ${negative ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 100 20"
                  >
                    <path d={negative ? 'M0 5 L20 8 L40 6 L60 12 L80 15 L100 18' : 'M0 18 L20 12 L40 10 L60 5 L80 8 L100 2'} />
                  </svg>
                  <button
                    type="button"
                    onClick={() => router.push(buildActiveConnectionHref(marketplace.name))}
                    className="text-[#004bd9] text-xs font-bold transition-all duration-150 ease-out hover:underline focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
                  >
                    DETAILS
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section ref={proposalsRef}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">New Proposals</h3>
          <button
            type="button"
            onClick={() => proposalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="text-[13px] text-[#004bd9] font-bold transition-all duration-150 ease-out hover:underline focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
          >
            VIEW ALL PROPOSALS
          </button>
        </div>
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#BFCBDA] bg-white px-4 py-6 text-[13px] text-[#6B7480]">
              Proposal queue cleared. Explore a suggested match or open Channels to continue activation.
            </div>
          ) : (
            proposals.map((proposal) => (
              <div key={proposal.name} className="bg-white border border-[#DDE5EE] p-4 flex items-center transition-all duration-150 ease-out hover:bg-[#F2F8FF]/40">
                <div className="w-12 h-12 bg-white flex-shrink-0 flex items-center justify-center border border-[#DDE5EE] p-2 rounded">
                  <Store className="h-6 w-6 text-[#6B7480]" />
                </div>
                <div className="ml-6 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-4 lg:items-center">
                  <div>
                    <h4 className="font-serif text-lg font-bold text-[#03182F]">{proposal.name}</h4>
                    <p className="text-[12px] text-[#6B7480]">{proposal.category}</p>
                  </div>
                  <div className="text-left lg:text-center">
                    <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">DAILY USERS</p>
                    <p className="font-serif text-lg font-bold text-[#03182F]">{proposal.dailyUsers}</p>
                  </div>
                  <div className="text-left lg:text-center">
                    <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">LAST YEAR REVENUE</p>
                    <p className="font-serif text-lg font-bold text-[#03182F]">{proposal.revenue}</p>
                  </div>
                  <div className="flex justify-start gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleDecline(proposal.name)}
                      className="h-9 w-9 bg-[#ba1a1a] text-white transition-all duration-150 ease-out hover:bg-[#ba1a1a]/90 rounded shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#F22E75]/40"
                      aria-label={`Decline ${proposal.name}`}
                      title="Decline"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMessage(proposal.name)}
                      className="h-9 w-9 bg-[#004bd9] text-white transition-all duration-150 ease-out hover:bg-[#004bd9]/90 rounded shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
                      aria-label={`Message ${proposal.name}`}
                      title="Message"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccept(proposal.name)}
                      className="h-9 w-9 bg-[#3FA46A] text-white transition-all duration-150 ease-out hover:bg-[#3FA46A]/90 rounded shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#3FA46A]/40"
                      aria-label={`Accept ${proposal.name}`}
                      title="Accept"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="pb-12">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Smart Suggestions</h3>
          <div className="flex-1 h-px bg-[#DDE5EE]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MARKETPLACE_SUGGESTIONS.map((suggestion) => (
            <div
              key={suggestion.name}
              className="bg-white border border-dashed border-[#BFCBDA] p-5 flex flex-col items-center text-center rounded-lg transition-all duration-150 ease-out hover:border-[#004bd9]"
            >
              <div className="w-16 h-16 rounded-full bg-[#F2F8FF] flex items-center justify-center mb-4 border border-[#DDE5EE]">
                <Store className="h-8 w-8 text-[#6B7480]" />
              </div>
              <h5 className="font-serif text-base font-bold text-[#03182F]">{suggestion.name}</h5>
              <p className="text-[12px] text-[#6B7480] mt-1 px-4">{suggestion.desc}</p>
              <button
                type="button"
                onClick={() => handleExplore(suggestion)}
                className="mt-4 text-xs font-bold text-[#004bd9] flex items-center gap-1 transition-all duration-150 ease-out hover:gap-2 focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
              >
                EXPLORE MATCH <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
