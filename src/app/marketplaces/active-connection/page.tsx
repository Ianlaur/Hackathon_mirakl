'use client'

import { MoreVertical, Plus, Settings } from 'lucide-react'

const marketplaces = [
  {
    name: 'Amazon',
    bgColor: 'bg-[#232F3E]',
    icon: '🛒',
    status: 'Active · Live',
    statusColor: 'text-[#3FA46A]',
    revenue: '€42,000',
    revenueChange: '+12.4%',
    revenueUp: true,
    itemsSold: '1,240',
    customers: '85.2K',
    sparkPath: 'M0 25 Q 10 5, 20 20 T 40 10 T 60 22 T 80 5 T 100 15',
    sparkColor: '#3FA46A',
  },
  {
    name: 'Rakuten',
    bgColor: 'bg-[#BF0000]',
    icon: 'R',
    isText: true,
    status: 'Active · Live',
    statusColor: 'text-[#3FA46A]',
    revenue: '€28,150',
    revenueChange: '-2.1%',
    revenueUp: false,
    itemsSold: '892',
    customers: '12.4K',
    sparkPath: 'M0 5 Q 20 25, 40 15 T 60 10 T 80 25 T 100 20',
    sparkColor: '#F22E75',
  },
  {
    name: 'Cdiscount',
    bgColor: 'bg-[#FF6600]',
    icon: '🛍️',
    status: 'Active · Live',
    statusColor: 'text-[#3FA46A]',
    revenue: '€15,400',
    revenueChange: '+8.3%',
    revenueUp: true,
    itemsSold: '456',
    customers: '4.2K',
    sparkPath: 'M0 28 Q 20 20, 40 25 T 60 5 T 80 15 T 100 10',
    sparkColor: '#3FA46A',
  },
  {
    name: 'Leroy Merlin',
    bgColor: 'bg-[#008A49]',
    icon: '🏠',
    status: 'Syncing · 98%',
    statusColor: 'text-[#E0A93A]',
    revenue: '€9,820',
    revenueChange: '+32.5%',
    revenueUp: true,
    itemsSold: '215',
    customers: '1.8K',
    sparkPath: 'M0 30 L 10 25 L 20 28 L 30 15 L 40 18 L 50 10 L 60 12 L 70 5 L 80 8 L 90 2 L 100 4',
    sparkColor: '#3FA46A',
  },
]

const apiRows = [
  { name: 'Amazon UK/EU', lastSync: '2026-04-23 14:02:45', latency: '142ms', errorRate: '0.02%', errorColor: 'text-[#3FA46A]' },
  { name: 'Rakuten FR', lastSync: '2026-04-23 14:02:12', latency: '310ms', errorRate: '0.84%', errorColor: 'text-[#E0A93A]' },
  { name: 'Cdiscount FR', lastSync: '2026-04-23 14:01:58', latency: '98ms', errorRate: '0.01%', errorColor: 'text-[#3FA46A]' },
  { name: 'Leroy Merlin EU', lastSync: '2026-04-23 13:59:30', latency: '520ms', errorRate: '1.20%', errorColor: 'text-[#F22E75]' },
]

export default function ActiveConnectionPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">
            Active Marketplace Connections
          </h1>
          <p className="text-[#6B7480] text-sm mt-1">
            Real-time operational status across your global distribution network.
          </p>
        </div>
        <button className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-semibold rounded-lg hover:bg-[#004bd9]/90 transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Connect New Channel
        </button>
      </div>

      {/* Marketplace Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {marketplaces.map((mp) => (
          <div
            key={mp.name}
            className="bg-white border border-[#DDE5EE] rounded-xl p-6 transition-all hover:border-[#2764ff]/30"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${mp.bgColor} flex items-center justify-center`}>
                  {mp.isText ? (
                    <span className="text-white font-bold text-xl italic">{mp.icon}</span>
                  ) : (
                    <span className="text-lg">{mp.icon}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-[#03182F]">{mp.name}</h3>
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${mp.statusColor}`}>
                    {mp.status}
                  </span>
                </div>
              </div>
              <button className="text-[#6B7480] hover:text-[#03182F]">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {/* Revenue */}
            <div className="space-y-6">
              <div>
                <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase mb-1">
                  Monthly Revenue
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">
                    {mp.revenue}
                  </span>
                  <span className={`text-[12px] italic ${mp.revenueUp ? 'text-[#3FA46A]' : 'text-[#F22E75]'}`}>
                    {mp.revenueChange}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                <div>
                  <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase mb-1">
                    Items Sold
                  </p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{mp.itemsSold}</p>
                </div>
                <div>
                  <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase mb-1">
                    Unique Customers
                  </p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{mp.customers}</p>
                </div>
              </div>

              {/* Sparkline + Action */}
              <div className="flex items-center justify-between pt-2">
                <svg className="w-24 h-8 overflow-visible" viewBox="0 0 100 30">
                  <path d={mp.sparkPath} fill="none" stroke={mp.sparkColor} strokeWidth="1.5" />
                </svg>
                <button className="text-[#004bd9] text-[13px] font-semibold hover:underline">
                  View Ledger
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API Health Table */}
      <div className="bg-white border border-[#DDE5EE] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DDE5EE] bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-serif text-base font-bold text-[#03182F]">API Health & Sync Status</h3>
          <span className="px-2 py-1 bg-[#3FA46A]/10 text-[#3FA46A] text-[10px] font-bold rounded uppercase tracking-wider">
            All Systems Operational
          </span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/30">
              <th className="px-6 py-3 border-b border-[#DDE5EE] font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase">
                Marketplace
              </th>
              <th className="px-6 py-3 border-b border-[#DDE5EE] font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase">
                Last Sync
              </th>
              <th className="px-6 py-3 border-b border-[#DDE5EE] font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase">
                Latency
              </th>
              <th className="px-6 py-3 border-b border-[#DDE5EE] font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase">
                Error Rate
              </th>
              <th className="px-6 py-3 border-b border-[#DDE5EE] font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {apiRows.map((row) => (
              <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-[#03182F]/5 flex items-center justify-center text-[#03182F] text-xs">
                    ☁️
                  </div>
                  <span className="font-serif text-sm font-semibold">{row.name}</span>
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-[#6B7480]">{row.lastSync}</td>
                <td className="px-6 py-4 text-[13px]">{row.latency}</td>
                <td className={`px-6 py-4 text-[13px] ${row.errorColor}`}>{row.errorRate}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-[#004bd9] hover:text-[#004bd9]/70">
                    <Settings className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
