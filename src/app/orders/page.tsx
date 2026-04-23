'use client'

import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'

const stats = [
  { label: 'PENDING ACTION', value: '14', color: 'text-[#F22E75]', badge: '+2h', badgeBg: 'bg-[#F22E75]/10 text-[#F22E75]' },
  { label: 'IN TRANSIT', value: '128', color: 'text-[#004bd9]', badge: '89%', badgeBg: 'bg-[#004bd9]/10 text-[#004bd9]' },
  { label: 'DELIVERED (24H)', value: '342', color: 'text-[#3FA46A]', badge: '↑4%', badgeBg: 'bg-[#3FA46A]/10 text-[#3FA46A]' },
  { label: 'PROCESSING', value: '56', color: 'text-[#03182F]', badge: 'AVG', badgeBg: 'bg-slate-100 text-[#6B7480]' },
]

const orders = [
  {
    marketplace: 'Amazon DE',
    mpColor: 'bg-orange-500',
    mpCode: 'AMZ',
    orderId: '#ORD-99210-XC',
    date: 'Today, 10:24 AM',
    status: 'Action Required',
    statusStyle: 'bg-[#FFE7EC] text-[#F22E75]',
    items: 2,
    value: '€142.00',
  },
  {
    marketplace: 'Bol.com',
    mpColor: 'bg-[#2764FF]',
    mpCode: 'BOL',
    orderId: '#ORD-88271-AA',
    date: 'Yesterday, 4:15 PM',
    status: 'Shipped',
    statusStyle: 'bg-[#e8f1ff] text-[#004bd9]',
    items: 1,
    value: '€89.50',
  },
  {
    marketplace: 'Zalando FR',
    mpColor: 'bg-black',
    mpCode: 'ZLD',
    orderId: '#ORD-77112-ZZ',
    date: 'Nov 14, 2023',
    status: 'Delivered',
    statusStyle: 'bg-[#3FA46A]/10 text-[#3FA46A] border border-[#3FA46A]/10',
    items: 5,
    value: '€412.99',
  },
  {
    marketplace: 'Amazon FR',
    mpColor: 'bg-orange-500',
    mpCode: 'AMZ',
    orderId: '#ORD-66231-PP',
    date: 'Nov 14, 2023',
    status: 'Processing',
    statusStyle: 'bg-slate-100 text-[#6B7480]',
    items: 1,
    value: '€55.00',
  },
]

const logFeed = [
  { color: 'bg-[#3FA46A]', time: '14:02:11', text: 'Carrier picked up #ORD-88271-AA from Warehouse A.', pulse: false },
  { color: 'bg-[#F22E75]', time: '13:58:45', text: 'Payment verification failed for #ORD-99210-XC (AMZ DE).', pulse: true },
  { color: 'bg-[#004bd9]', time: '13:45:02', text: 'Label generated for #ORD-22109-BY via DHL Express.', pulse: false },
]

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Orders</h1>
          <p className="font-serif text-[13px] text-[#6B7480] mt-1 italic">Real-time fulfillment operations and logistics hub.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737687]" />
            <input
              className="pl-10 pr-4 h-9 w-64 bg-white border border-[#DDE5EE] rounded font-serif text-[13px] focus:ring-1 focus:ring-[#004bd9] focus:border-[#004bd9] outline-none"
              placeholder="Search orders..."
              type="text"
            />
          </div>
          <button className="h-9 px-4 border border-[#BFCBDA] rounded flex items-center gap-2 bg-white font-serif text-[13px] font-bold hover:bg-[#f3f2ff] transition-colors">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
          <button className="h-9 px-4 bg-[#004bd9] text-white rounded font-serif text-[13px] font-bold hover:opacity-90 transition-opacity">
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="p-6 bg-white border border-[#DDE5EE] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase block mb-2">{s.label}</span>
            <div className="flex items-end justify-between">
              <span className={`font-serif text-[44px] font-bold leading-none tracking-tight italic ${s.color}`}>{s.value}</span>
              <div className={`w-12 h-6 rounded flex items-center justify-center ${s.badgeBg}`}>
                <span className="text-[10px] font-mono">{s.badge}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#DDE5EE] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f3f2ff] border-b border-[#DDE5EE]">
            <tr>
              {['Marketplace', 'Order ID & Date', 'Status', 'Items', 'Value'].map((h, i) => (
                <th key={h} className={`px-6 py-4 font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase ${i === 4 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map((o) => (
              <tr key={o.orderId} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded ${o.mpColor} flex items-center justify-center text-[8px] text-white font-bold`}>
                      {o.mpCode}
                    </div>
                    <span className="font-serif text-[13px]">{o.marketplace}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-mono text-[12px] font-bold text-[#191b24]">{o.orderId}</span>
                    <span className="font-serif text-[12px] text-[#6B7480]">{o.date}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-tight uppercase ${o.statusStyle}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                    {o.items > 1 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-[#6B7480]">+{o.items - 1}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-mono text-[13px] font-bold">{o.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-4 bg-white border-t border-[#DDE5EE] flex items-center justify-between">
          <span className="font-serif text-[12px] text-[#6B7480]">
            Showing <span className="font-bold">1-10</span> of <span className="font-bold">2,451</span> orders
          </span>
          <div className="flex gap-1">
            <button className="w-8 h-8 rounded border border-[#DDE5EE] flex items-center justify-center text-[#6B7480] hover:bg-slate-50 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded bg-[#004bd9] text-white text-[11px] font-bold">1</button>
            <button className="w-8 h-8 rounded border border-[#DDE5EE] text-[11px] font-bold text-[#6B7480] hover:bg-slate-50 transition-colors">2</button>
            <button className="w-8 h-8 rounded border border-[#DDE5EE] text-[11px] font-bold text-[#6B7480] hover:bg-slate-50 transition-colors">3</button>
            <button className="w-8 h-8 rounded border border-[#DDE5EE] flex items-center justify-center text-[#6B7480] hover:bg-slate-50 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-white border border-[#DDE5EE] rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif text-base font-bold text-[#03182F]">Logistics Feed</h3>
            <span className="text-[10px] font-mono uppercase text-[#004bd9] bg-[#004bd9]/5 px-2 py-1 rounded">Live Syncing</span>
          </div>
          <div className="space-y-3">
            {logFeed.map((l, i) => (
              <div key={i} className="flex items-center h-8 border-b border-slate-50">
                <span className={`w-2 h-2 rounded-full ${l.color} mr-4 ${l.pulse ? 'animate-pulse' : ''}`} />
                <span className="font-mono text-[10px] text-[#6B7480] w-20">{l.time}</span>
                <span className="font-serif text-[13px] text-[#191b24]">{l.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-4 bg-[#03182F] text-white rounded-lg p-6 flex flex-col justify-between">
          <div>
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase block mb-2">QUICK DECISION</span>
            <h4 className="font-serif text-base font-bold mb-2">Restock Alert: Best Seller</h4>
            <p className="font-serif text-[12px] text-slate-300">&quot;Modern Ceramic Vase&quot; inventory below 10% on Amazon DE. Orders may stall.</p>
          </div>
          <div className="mt-4 space-y-2">
            <button className="w-full h-9 bg-[#004bd9] text-white rounded font-serif text-[13px] font-bold hover:opacity-90">Auto-Replenish</button>
            <button className="w-full h-9 bg-transparent border border-slate-700 text-white rounded font-serif text-[13px] font-bold hover:bg-white/5">Snooze Alert</button>
          </div>
        </div>
      </div>
    </div>
  )
}
