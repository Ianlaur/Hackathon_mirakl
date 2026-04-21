'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  DollarSign,
  Filter,
  Globe2,
  MapPin,
  Package,
  Search,
  SendHorizontal,
  Sparkles,
  Truck,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

const PRO_PLUGIN_KEY = 'mirakl_global_control_tower_active'

type Order = {
  id: string
  product: string
  status: 'Processing' | 'Delivered' | 'In Transit' | 'Blocked'
  origin: string
  destination: string
  eta: string
}

const BASIC_ORDERS: Order[] = [
  { id: '#ORDER-884', product: '1 Oak Table', status: 'Processing', origin: 'Paris, FR', destination: 'Lyon, FR', eta: 'Nov 22' },
  { id: '#ORDER-880', product: '2 Dining Chairs', status: 'Delivered', origin: 'Bordeaux, FR', destination: 'Marseille, FR', eta: 'Nov 18' },
  { id: '#ORDER-876', product: '3 Bar Stools', status: 'In Transit', origin: 'Lyon, FR', destination: 'Nice, FR', eta: 'Nov 21' },
  { id: '#ORDER-871', product: '1 Bookshelf', status: 'Delivered', origin: 'Paris, FR', destination: 'Toulouse, FR', eta: 'Nov 16' },
]

const PRO_ORDERS: Order[] = [
  { id: '#ORDER-883', product: '50 Oak Tables', status: 'Blocked', origin: 'Shanghai, CN', destination: 'Marseille, FR', eta: 'Delayed' },
  { id: '#ORDER-877', product: '120 Sofas', status: 'In Transit', origin: 'Rotterdam, NL', destination: 'Lyon, FR', eta: 'Nov 20' },
  { id: '#ORDER-864', product: '30 Dining Sets', status: 'Delivered', origin: 'Shenzhen, CN', destination: 'Frankfurt, DE', eta: 'Nov 14' },
  { id: '#ORDER-859', product: '80 Bar Stools', status: 'Processing', origin: 'Hamburg, DE', destination: 'Nice, FR', eta: 'Nov 28' },
]

function statusStyle(status: Order['status']) {
  if (status === 'Delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'In Transit') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'Blocked') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-indigo-200 bg-indigo-50 text-indigo-700'
}

export default function DashboardPage() {
  const [isPro, setIsPro] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    setIsPro(window.localStorage.getItem(PRO_PLUGIN_KEY) === 'true')
  }, [])

  const orders = isPro ? PRO_ORDERS : BASIC_ORDERS
  const kpis = isPro
    ? [
        { label: 'Total Revenue', value: '€2.47M', trend: '+12.4% vs last month', icon: DollarSign, trendColor: 'text-emerald-600' },
        { label: 'Stripe Liquidity Available', value: '€184,300', trend: '+€23,500 this week', icon: Wallet, trendColor: 'text-emerald-600' },
        { label: 'Active Shipments', value: '127', trend: '-3 blocked at port', icon: Package, trendColor: 'text-rose-600' },
      ]
    : [
        { label: 'Total Revenue', value: '€8,240', trend: '+6.2% vs last month', icon: DollarSign, trendColor: 'text-emerald-600' },
        { label: 'Total Orders', value: '34', trend: '+4 this week', icon: Package, trendColor: 'text-emerald-600' },
      ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Control Tower</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isPro ? 'border border-indigo-200 bg-indigo-50 text-indigo-700' : 'border border-slate-200 bg-slate-100 text-slate-600'
                }`}
              >
                {isPro ? 'PRO · AI ACTIVE' : 'BASIC'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {isPro ? 'Global Control Tower plugin active' : 'BASIC mode with simplified automation rules'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app-store"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <Zap className="h-4 w-4" /> Manage Plugins <ArrowRight className="h-4 w-4" />
            </Link>

            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input className="w-44 border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search orders..." />
            </label>

            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              <Filter className="h-4 w-4" /> Filter
            </button>

            <button className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className={`grid gap-3 ${isPro ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {kpis.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                  <p className={`mt-2 text-base font-medium ${item.trendColor}`}>↗ {item.trend}</p>
                </div>
                <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          ))}
        </section>

        {isPro && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Globe2 className="h-4 w-4 text-indigo-600" />
                Global Shipment Tracker
                <span className="text-emerald-600">● LIVE</span>
              </div>
              <div className="text-xs text-slate-500">On Track · In Transit · Blocked</div>
            </div>

            <div className="h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <svg viewBox="0 0 900 320" className="h-full w-full">
                <rect x="0" y="0" width="900" height="320" fill="#f8fafc" />
                <path d="M60 70 L170 60 L190 110 L175 165 L120 185 L80 160 L65 120 Z" fill="#dbeafe" />
                <path d="M320 70 L440 65 L470 110 L430 140 L360 130 Z" fill="#dbeafe" />
                <path d="M470 60 L680 55 L710 95 L700 160 L620 180 L520 150 L470 110 Z" fill="#dbeafe" />
                <path d="M730 190 L810 185 L835 240 L800 280 L740 278 L720 235 Z" fill="#dbeafe" />
                <path d="M190 110 Q320 60 430 100" stroke="#22c55e" strokeDasharray="6 5" strokeWidth="2" fill="none" />
                <path d="M430 100 Q540 80 620 130" stroke="#f59e0b" strokeDasharray="6 5" strokeWidth="2" fill="none" />
                <path d="M430 100 Q570 90 670 120" stroke="#6366f1" strokeDasharray="6 5" strokeWidth="2" fill="none" />
                <circle cx="190" cy="110" r="5" fill="#22c55e" />
                <circle cx="620" cy="130" r="5" fill="#f59e0b" />
                <circle cx="470" cy="95" r="5" fill="#ef4444" />
                <circle cx="670" cy="120" r="5" fill="#f59e0b" />
              </svg>
            </div>
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{isPro ? 'Global Orders' : 'Recent Orders'}</h2>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">{orders.length} orders</span>
            </div>
            <button className="text-sm font-semibold text-indigo-700">View all →</button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-white text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Origin → Dest.</th>
                  <th className="px-4 py-3">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4 font-semibold text-indigo-700">{order.id}</td>
                    <td className="px-4 py-4 font-medium text-slate-800">{order.product}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${statusStyle(order.status)}`}>
                        {order.status === 'Delivered' && <CheckCircle2 className="mr-1 h-4 w-4" />}
                        {order.status === 'In Transit' && <Truck className="mr-1 h-4 w-4" />}
                        {order.status === 'Processing' && <Clock3 className="mr-1 h-4 w-4" />}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" /> {order.origin}</span>{' '}
                      <span className="text-slate-400">→</span> {order.destination}
                    </td>
                    <td className={`px-4 py-4 font-semibold ${order.status === 'Blocked' ? 'text-rose-700' : 'text-slate-800'}`}>{order.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <button
        onClick={() => setChatOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300 transition hover:bg-indigo-500"
        aria-label="Toggle AI Copilot"
      >
        {chatOpen ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {chatOpen && (
        <aside className="fixed bottom-24 right-6 z-40 flex h-[70vh] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-indigo-600 p-2 text-white"><Sparkles className="h-4 w-4" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">AI Copilot {isPro && <span className="text-xs text-indigo-700">PRO</span>}</h3>
                <p className="text-sm font-medium text-emerald-600">● Active · {isPro ? 'Monitoring 127 shipments' : '4 local orders'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
            {(isPro ? ['Order #883', 'Marseille Strike', 'Stripe Payments'] : ['Order #884', 'Shippo Label', 'Local Delivery']).map((tag) => (
              <span key={tag} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">{tag}</span>
            ))}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 text-sm">
            {isPro ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700">⚠️ Alert: Maritime strike detected at the Port of Marseille. Shipment #883 is blocked.</div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700">I have calculated 2 rerouting options for your global channels.</div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <p className="font-semibold text-slate-900">FAST · Reroute via Genova</p>
                    <p className="mt-1 text-slate-600">DHL · +€150 · +2 days · High CO₂</p>
                    <button className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white">Approve & Pay</button>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">SLOW · Wait at Port</p>
                    <p className="mt-1 text-slate-600">Ship · +€0 · +7-10 days · Low CO₂</p>
                    <button className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">Select Option</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700">👋 Hello! I&apos;m your Mirakl AI assistant. I&apos;m monitoring your local orders.</div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700">📦 New order #884 received. Label generated via Shippo. ETA Nov 22 to Lyon.</div>
              </>
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder={isPro ? 'Ask about shipments, inventory, payments...' : 'Ask about your orders...'} />
              <button className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-500"><SendHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
