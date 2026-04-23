import { Store, Mail, ArrowRight } from 'lucide-react'

const connectedMarketplaces = [
  {
    name: 'Amazon',
    revenue: '€42,000',
    change: '+12.4%',
    status: 'STABLE' as const,
    icon: '🛒',
  },
  {
    name: 'Rakuten',
    revenue: '€28,500',
    change: '+5.1%',
    status: 'STABLE' as const,
    icon: '🏬',
  },
  {
    name: 'Cdiscount',
    revenue: '€14,200',
    change: '-2.4%',
    status: 'REVIEW' as const,
    icon: '📦',
  },
  {
    name: 'Leroy Merlin',
    revenue: '€31,800',
    change: '+18.2%',
    status: 'STABLE' as const,
    icon: '🔨',
  },
]

const proposals = [
  {
    name: 'Darty',
    category: 'Electronics & Home',
    dailyUsers: '2.4M',
    revenue: '€850M',
  },
  {
    name: 'Carrefour',
    category: 'Retail Giant',
    dailyUsers: '4.8M',
    revenue: '€1.2B',
  },
  {
    name: 'Auchan',
    category: 'Hypermarket Chain',
    dailyUsers: '3.1M',
    revenue: '€920M',
  },
  {
    name: 'ManoMano',
    category: 'DIY & Garden',
    dailyUsers: '1.8M',
    revenue: '€540M',
  },
]

const suggestions = [
  {
    name: 'Vente-privee',
    desc: 'Ideal for clearance of high-end furniture stock.',
  },
  {
    name: 'Wayfair',
    desc: 'Strong alignment with your upholstery product category.',
  },
  {
    name: 'Home24',
    desc: 'Growth opportunity in the DACH furniture market.',
  },
]

export default function MarketplacesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">
            Marketplaces Overview
          </h1>
          <p className="text-[#6B7480] text-sm mt-1">
            Manage your active channels and discover new expansion opportunities.
          </p>
        </div>
        <button className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-semibold rounded hover:bg-[#004bd9]/90 transition-colors flex items-center gap-2">
          <span className="text-sm">+</span>
          New Channel
        </button>
      </div>

      {/* Connected Marketplaces */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">
            Connected Marketplaces
          </h3>
          <span className="font-mono text-[10px] text-[#2764ff] font-bold">
            {connectedMarketplaces.length} ACTIVE CHANNELS
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {connectedMarketplaces.map((mp) => {
            const isNegative = mp.change.startsWith('-')
            return (
              <div
                key={mp.name}
                className="bg-white border border-[#DDE5EE] p-5 rounded hover:shadow-md transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-slate-100 text-xl">
                    {mp.icon}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      mp.status === 'STABLE'
                        ? 'bg-[#3FA46A]/10 text-[#3FA46A]'
                        : 'bg-[#FFE7EC] text-[#F22E75]'
                    }`}
                  >
                    {mp.status}
                  </span>
                </div>
                <h4 className="font-serif text-base font-bold text-[#03182F]">{mp.name}</h4>
                <p className="text-[12px] text-[#6B7480]">Revenue Generated</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-[22px] font-bold text-[#03182F]">
                    {mp.revenue}
                  </span>
                  <span
                    className={`font-mono text-[10px] ${isNegative ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`}
                  >
                    {mp.change}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div className="w-24 h-6">
                    <svg
                      className={`w-full h-full ${isNegative ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 100 20"
                    >
                      <path
                        d={
                          isNegative
                            ? 'M0 5 L20 8 L40 6 L60 12 L80 15 L100 18'
                            : 'M0 18 L20 12 L40 10 L60 5 L80 8 L100 2'
                        }
                      />
                    </svg>
                  </div>
                  <button className="text-[#004bd9] text-xs font-bold hover:underline">
                    DETAILS
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* New Proposals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">
            New Proposals
          </h3>
          <button className="text-[13px] text-[#004bd9] font-bold hover:underline">
            VIEW ALL PROPOSALS
          </button>
        </div>
        <div className="space-y-4">
          {proposals.map((p) => (
            <div
              key={p.name}
              className="bg-white border border-[#DDE5EE] p-4 flex items-center hover:bg-slate-50 transition-colors"
            >
              <div className="w-12 h-12 bg-white flex-shrink-0 flex items-center justify-center border border-slate-200 p-2 rounded">
                <Store className="h-6 w-6 text-slate-400" />
              </div>
              <div className="ml-6 flex-1 grid grid-cols-4 items-center">
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#03182F]">{p.name}</h4>
                  <p className="text-[12px] text-[#6B7480]">{p.category}</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">
                    DAILY USERS
                  </p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{p.dailyUsers}</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">
                    LAST YEAR REVENUE
                  </p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{p.revenue}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="h-9 px-4 bg-[#ba1a1a] text-white text-[13px] font-bold hover:bg-[#ba1a1a]/90 transition-colors rounded shadow-sm">
                    DECLINE
                  </button>
                  <button className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-bold hover:bg-[#004bd9]/90 transition-colors flex items-center gap-1 rounded shadow-sm">
                    <Mail className="h-3.5 w-3.5" />
                    MESSAGE
                  </button>
                  <button className="h-9 px-4 bg-[#3FA46A] text-white text-[13px] font-bold hover:bg-[#3FA46A]/90 transition-colors rounded shadow-sm">
                    ACCEPT
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Smart Suggestions */}
      <section className="pb-12">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">
            Smart Suggestions
          </h3>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suggestions.map((s) => (
            <div
              key={s.name}
              className="bg-white border border-dashed border-slate-300 p-5 flex flex-col items-center text-center rounded-lg hover:border-[#004bd9] transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <Store className="h-8 w-8 text-slate-300" />
              </div>
              <h5 className="font-serif text-base font-bold text-[#03182F]">{s.name}</h5>
              <p className="text-[12px] text-[#6B7480] mt-1 px-4">{s.desc}</p>
              <button className="mt-4 text-xs font-bold text-[#004bd9] flex items-center gap-1 hover:gap-2 transition-all">
                EXPLORE MATCH
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
