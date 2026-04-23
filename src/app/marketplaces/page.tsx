'use client'

import { useState } from 'react'
import { Store, Mail, ArrowRight, Paperclip, Send, X, Check, Download } from 'lucide-react'

type Tab = 'proposals' | 'active'

/* ── Data ── */

const connectedMarketplaces = [
  { name: 'Amazon', revenue: '€42,000', change: '+12.4%', status: 'STABLE' as const, icon: '🛒' },
  { name: 'Rakuten', revenue: '€28,500', change: '+5.1%', status: 'STABLE' as const, icon: '🏬' },
  { name: 'Cdiscount', revenue: '€14,200', change: '-2.4%', status: 'REVIEW' as const, icon: '📦' },
  { name: 'Leroy Merlin', revenue: '€31,800', change: '+18.2%', status: 'STABLE' as const, icon: '🔨' },
]

const proposals = [
  { name: 'Darty', category: 'Electronics & Home', dailyUsers: '2.4M', revenue: '€850M' },
  { name: 'Carrefour', category: 'Retail Giant', dailyUsers: '4.8M', revenue: '€1.2B' },
  { name: 'Auchan', category: 'Hypermarket Chain', dailyUsers: '3.1M', revenue: '€920M' },
  { name: 'ManoMano', category: 'DIY & Garden', dailyUsers: '1.8M', revenue: '€540M' },
]

const suggestions = [
  { name: 'Vente-privee', desc: 'Ideal for clearance of high-end furniture stock.' },
  { name: 'Wayfair', desc: 'Strong alignment with your upholstery product category.' },
  { name: 'Home24', desc: 'Growth opportunity in the DACH furniture market.' },
]

const conversations = [
  { name: 'Darty', lastMsg: 'MIRA: The category mapping is ready for your...', time: '14:20', active: true },
  { name: 'Carrefour', lastMsg: 'We are reviewing your luxury goods catalog...', time: 'YESTERDAY', active: false },
  { name: 'Auchan', lastMsg: 'MIRA: Proposal sent for the Q4 integration phase.', time: 'MON', active: false },
  { name: 'ManoMano', lastMsg: 'MIRA: Checking logistics API endpoints.', time: 'OCT 24', active: false },
]

const messages = [
  {
    from: 'darty',
    text: 'Hello Fanny, we have reviewed your "Luxe Boutique" catalog. We would like to propose a premium placement on our Home & Tech section for the upcoming Black Friday period. Would you be open to syncing your inventory via Mirakl Connect?',
    time: '10:45 AM',
  },
  {
    from: 'mira',
    text: 'MIRA has analyzed the proposal. Integration compatibility for Black Friday is 94%. I have prepared the initial category mapping for your approval.',
    time: '11:02 AM · AUTOPILOT',
  },
  {
    from: 'darty',
    text: "Perfect. We've sent the technical requirements for the API sync. Please confirm once you've had a chance to look at the shipping categories.",
    time: '14:15 PM',
  },
]

const requirements = [
  { label: 'Mirakl API Key', status: 'ok' },
  { label: 'Catalog Matching (94%)', status: 'ok' },
  { label: 'Shipping Policy Review', status: 'warn' },
  { label: 'Contract Signature', status: 'pending' },
]

/* ── Components ── */

function ProposalsTab() {
  return (
    <div className="space-y-6">
      {/* Connected Marketplaces */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Connected Marketplaces</h3>
          <span className="font-mono text-[10px] text-[#2764ff] font-bold">{connectedMarketplaces.length} ACTIVE CHANNELS</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {connectedMarketplaces.map((mp) => {
            const neg = mp.change.startsWith('-')
            return (
              <div key={mp.name} className="bg-white border border-[#DDE5EE] p-5 rounded hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-slate-100 text-xl">{mp.icon}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${mp.status === 'STABLE' ? 'bg-[#3FA46A]/10 text-[#3FA46A]' : 'bg-[#FFE7EC] text-[#F22E75]'}`}>{mp.status}</span>
                </div>
                <h4 className="font-serif text-base font-bold text-[#03182F]">{mp.name}</h4>
                <p className="text-[12px] text-[#6B7480]">Revenue Generated</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-[22px] font-bold text-[#03182F]">{mp.revenue}</span>
                  <span className={`font-mono text-[10px] ${neg ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`}>{mp.change}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <svg className={`w-24 h-6 ${neg ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 100 20">
                    <path d={neg ? 'M0 5 L20 8 L40 6 L60 12 L80 15 L100 18' : 'M0 18 L20 12 L40 10 L60 5 L80 8 L100 2'} />
                  </svg>
                  <button className="text-[#004bd9] text-xs font-bold hover:underline">DETAILS</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* New Proposals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">New Proposals</h3>
          <button className="text-[13px] text-[#004bd9] font-bold hover:underline">VIEW ALL PROPOSALS</button>
        </div>
        <div className="space-y-4">
          {proposals.map((p) => (
            <div key={p.name} className="bg-white border border-[#DDE5EE] p-4 flex items-center hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 bg-white flex-shrink-0 flex items-center justify-center border border-slate-200 p-2 rounded">
                <Store className="h-6 w-6 text-[#6B7480]" />
              </div>
              <div className="ml-6 flex-1 grid grid-cols-4 items-center">
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#03182F]">{p.name}</h4>
                  <p className="text-[12px] text-[#6B7480]">{p.category}</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">DAILY USERS</p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{p.dailyUsers}</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">LAST YEAR REVENUE</p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{p.revenue}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="h-9 px-4 bg-[#ba1a1a] text-white text-[13px] font-bold hover:bg-[#ba1a1a]/90 transition-colors rounded shadow-sm">DECLINE</button>
                  <button className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-bold hover:bg-[#004bd9]/90 transition-colors flex items-center gap-1 rounded shadow-sm">
                    <Mail className="h-3.5 w-3.5" />MESSAGE
                  </button>
                  <button className="h-9 px-4 bg-[#3FA46A] text-white text-[13px] font-bold hover:bg-[#3FA46A]/90 transition-colors rounded shadow-sm">ACCEPT</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Smart Suggestions */}
      <section className="pb-12">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Smart Suggestions</h3>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suggestions.map((s) => (
            <div key={s.name} className="bg-white border border-dashed border-[#BFCBDA] p-5 flex flex-col items-center text-center rounded-lg hover:border-[#004bd9] transition-all">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <Store className="h-8 w-8 text-slate-300" />
              </div>
              <h5 className="font-serif text-base font-bold text-[#03182F]">{s.name}</h5>
              <p className="text-[12px] text-[#6B7480] mt-1 px-4">{s.desc}</p>
              <button className="mt-4 text-xs font-bold text-[#004bd9] flex items-center gap-1 hover:gap-2 transition-all">
                EXPLORE MATCH <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ActiveConnectionTab() {
  const [selectedConv, setSelectedConv] = useState('Darty')

  return (
    <div className="flex border border-[#DDE5EE] bg-white rounded overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Left: Conversation list */}
      <aside className="w-80 border-r border-slate-200 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Active Proposals</h3>
        </div>
        <div className="flex-grow">
          {conversations.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setSelectedConv(c.name)}
              className={`w-full p-4 text-left transition-colors ${
                selectedConv === c.name
                  ? 'bg-[#dce1ff]/30 border-l-4 border-[#004bd9]'
                  : 'hover:bg-slate-50 border-l-4 border-transparent'
              }`}
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Store className="h-5 w-5 text-[#6B7480]" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-serif text-sm font-bold text-[#03182F]">{c.name}</span>
                    <span className="text-[10px] font-mono text-[#6B7480] uppercase">{c.time}</span>
                  </div>
                  <p className="text-[12px] text-[#6B7480] truncate italic">{c.lastMsg}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center: Chat */}
      <article className="flex-grow flex flex-col">
        {/* Chat header */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center">
              <Store className="h-5 w-5 text-[#6B7480]" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#03182F]">{selectedConv}</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3FA46A]" />
                <span className="text-[10px] font-mono text-[#6B7480] uppercase">Proposing Partner · Online</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="h-9 px-4 flex items-center gap-2 border border-[#BFCBDA] text-[#30373E] text-[11px] font-bold rounded hover:bg-slate-50 transition-colors uppercase">
              <X className="h-3.5 w-3.5" /> Decline
            </button>
            <button className="h-9 px-4 flex items-center gap-2 bg-[#3FA46A] text-white text-[11px] font-bold rounded hover:opacity-90 transition-opacity uppercase shadow-sm">
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button className="h-9 px-4 flex items-center gap-2 bg-[#004bd9] text-white text-[11px] font-bold rounded hover:opacity-90 transition-opacity uppercase shadow-sm">
              <Download className="h-3.5 w-3.5" /> Install
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-grow overflow-y-auto p-6 space-y-8 bg-[#faf8ff]">
          {messages.map((msg, i) => {
            if (msg.from === 'mira') {
              return (
                <div key={i} className="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-[#03182F] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">AI</div>
                  <div className="space-y-1 text-right">
                    <div className="bg-[#004bd9] text-white p-4 rounded-xl rounded-tr-none shadow-sm">
                      <p className="text-sm">{msg.text}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#6B7480] uppercase mr-1">{msg.time}</span>
                  </div>
                </div>
              )
            }
            return (
              <div key={i} className="flex gap-4 max-w-2xl">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex-shrink-0 flex items-center justify-center">
                  <Store className="h-4 w-4 text-[#6B7480]" />
                </div>
                <div className="space-y-1">
                  <div className="bg-white border border-[#DDE5EE] p-4 rounded-xl rounded-tl-none shadow-sm">
                    <p className="text-sm text-[#30373E]">{msg.text}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#6B7480] uppercase ml-1">{msg.time}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <footer className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
          <div className="flex gap-3 items-center bg-[#03182F] rounded-full p-1.5 pl-4 shadow-lg">
            <button className="text-[#6B7480] hover:text-white transition-colors">
              <Paperclip className="h-5 w-5" />
            </button>
            <input className="flex-grow bg-transparent border-none text-white text-sm focus:ring-0 focus:outline-none placeholder:text-[#6B7480] font-serif" placeholder={`Type your message to ${selectedConv} team...`} type="text" />
            <button className="bg-[#004bd9] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2764FF] transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </article>

      {/* Right: Info pane */}
      <aside className="w-72 border-l border-slate-200 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-6 space-y-8">
          {/* Brand card */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-lg bg-white border border-slate-100 shadow-sm mx-auto mb-4 flex items-center justify-center">
              <Store className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="font-serif text-[22px] font-bold text-[#03182F]">{selectedConv}</h3>
            <p className="text-[12px] text-[#6B7480] mt-1">High-Tech & Electronics Marketplace</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-[#F2F8FF] rounded-lg border border-[#DDE5EE]">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase block mb-1">Daily Users</span>
              <span className="font-serif text-2xl font-bold text-[#03182F]">2.4M</span>
            </div>
            <div className="p-4 bg-[#F2F8FF] rounded-lg border border-[#DDE5EE]">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase block mb-1">LY Revenue</span>
              <span className="font-serif text-2xl font-bold text-[#03182F]">€850M</span>
            </div>
          </div>

          {/* About */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-bold uppercase text-[#6B7480] tracking-wider">About</h4>
            <p className="text-[13px] text-[#6B7480] leading-relaxed">
              Leading French electronics retailer. Integrating provides access to a highly qualified consumer base focused on home appliances, computing, and high-end consumer electronics.
            </p>
          </div>

          {/* Requirements */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-bold uppercase text-[#6B7480] tracking-wider">Requirements</h4>
            <ul className="space-y-2">
              {requirements.map((r) => (
                <li key={r.label} className="flex items-start gap-2 text-[13px] text-[#6B7480]">
                  {r.status === 'ok' && <span className="text-[#3FA46A] text-base mt-0.5">&#10003;</span>}
                  {r.status === 'warn' && <span className="text-[#E0A93A] text-base mt-0.5">&#9888;</span>}
                  {r.status === 'pending' && <span className="text-slate-300 text-base mt-0.5">&#9675;</span>}
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Risk alert */}
          <div className="p-4 bg-[#FFE7EC] rounded-lg border border-[#F22E75]/20">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#F22E75] uppercase block">Risk Signal</span>
            <p className="text-[11px] text-[#F22E75] font-medium mt-1">Pricing for Black Friday must be finalized by Nov 1st to ensure placement.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ── Main Page ── */

export default function MarketplacesPage() {
  const [tab, setTab] = useState<Tab>('proposals')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Marketplaces Overview</h1>
          <p className="text-[#6B7480] text-sm mt-1">Manage your active channels and discover new expansion opportunities.</p>
        </div>
        <button className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-semibold rounded hover:bg-[#004bd9]/90 transition-colors flex items-center gap-2">
          <span className="text-sm">+</span> New Channel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#DDE5EE]">
        <button
          type="button"
          onClick={() => setTab('proposals')}
          className={`px-4 py-2.5 text-sm font-serif font-medium transition-colors relative ${
            tab === 'proposals'
              ? 'text-[#004bd9]'
              : 'text-[#6B7480] hover:text-[#03182F]'
          }`}
        >
          Integration Proposals
          {tab === 'proposals' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004bd9]" />}
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`px-4 py-2.5 text-sm font-serif font-medium transition-colors relative ${
            tab === 'active'
              ? 'text-[#004bd9]'
              : 'text-[#6B7480] hover:text-[#03182F]'
          }`}
        >
          Active Connections
          {tab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004bd9]" />}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'proposals' && <ProposalsTab />}
      {tab === 'active' && <ActiveConnectionTab />}
    </div>
  )
}
