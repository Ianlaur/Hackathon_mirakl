'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  DollarSign,
  Filter,
  MapPin,
  Package,
  Search,
  SendHorizontal,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'

const kpis = [
  {
    label: 'Total Revenue',
    value: '€8,240',
    trend: '+6.2% vs last month',
    icon: DollarSign,
    tone: 'emerald',
  },
  {
    label: 'Total Orders',
    value: '34',
    trend: '+4 this week',
    icon: Package,
    tone: 'indigo',
  },
]

const recentOrders = [
  {
    id: '#ORDER-884',
    product: '1 Oak Table',
    status: 'Processing',
    origin: 'Paris, FR',
    destination: 'Lyon, FR',
    eta: 'Nov 22',
  },
  {
    id: '#ORDER-880',
    product: '2 Dining Chairs',
    status: 'Delivered',
    origin: 'Bordeaux, FR',
    destination: 'Marseille, FR',
    eta: 'Nov 18',
  },
  {
    id: '#ORDER-876',
    product: '3 Bar Stools',
    status: 'In Transit',
    origin: 'Lyon, FR',
    destination: 'Nice, FR',
    eta: 'Nov 21',
  },
  {
    id: '#ORDER-871',
    product: '1 Bookshelf',
    status: 'Delivered',
    origin: 'Paris, FR',
    destination: 'Toulouse, FR',
    eta: 'Nov 16',
  },
]

function statusStyle(status: string) {
  if (status === 'Delivered') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (status === 'In Transit') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-indigo-200 bg-indigo-50 text-indigo-700'
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-3 sm:p-4 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1750px] grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <main className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  BASIC
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Local shipping · Powered by Shippo</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/app-store"
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                <Zap className="h-4 w-4" /> Upgrade to Pro <ArrowRight className="h-4 w-4" />
              </Link>

              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input
                  className="w-44 border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="Search orders..."
                />
              </label>

              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                <Filter className="h-4 w-4" /> Filter
              </button>

              <button className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50">
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </header>

          <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            {kpis.map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                    <p className="mt-4 text-5xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                    <p className="mt-2 text-lg font-medium text-emerald-600">↗ {item.trend}</p>
                  </div>
                  <div
                    className={`rounded-xl p-3 ${
                      item.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-5xl font-semibold tracking-tight text-slate-700">BASIC</h3>
            <p className="mt-2 text-lg text-slate-500">
              <Link href="/app-store" className="font-medium text-indigo-700 hover:text-indigo-600">
                Upgrade in App Store →
              </Link>
            </p>
          </section>

          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900">Recent Orders</h2>
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">4 orders</span>
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
                <tbody className="divide-y divide-slate-100 bg-white text-lg">
                  {recentOrders.map((order) => (
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
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-slate-400" /> {order.origin}
                        </span>{' '}
                        <span className="text-slate-400">→</span> {order.destination}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-800">{order.eta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-indigo-600 p-2 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">AI Copilot</h3>
                  <p className="text-sm font-medium text-emerald-600">● Active · 4 local orders</p>
                </div>
              </div>
              <button className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50">↻</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
            {['Order #884', 'Shippo Label', 'Local Delivery'].map((tag) => (
              <span key={tag} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="max-w-[92%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-700">
                👋 Hello! I&apos;m your Mirakl AI assistant. I&apos;m monitoring your local orders.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <Package className="h-4 w-4" />
              </div>
              <div className="max-w-[92%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-700">
                📦 New order #884 received for 1 Oak Table. Standard local shipping label generated via Shippo. Estimated delivery: Nov 22 to Lyon.
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Ask about your orders or deliveries..."
              />
              <button className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-500">
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
