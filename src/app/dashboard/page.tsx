'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
  Truck,
  Wallet,
  Zap,
} from 'lucide-react'
import type { Shipment, ShipmentStatus } from '@/types/shipment'
import { usePluginContext } from '@/contexts/PluginContext'

const GlobalShipmentTracker = dynamic(
  () => import('@/components/map/GlobalShipmentTracker'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] animate-pulse rounded-xl border border-slate-700/60 bg-slate-900" />
    ),
  }
)

type Order = {
  id: string
  product: string
  status: 'Processing' | 'Delivered' | 'In Transit' | 'Blocked'
  origin: string
  destination: string
  eta: string
  carrier: string
  co2: string
  stock: string
}

type InventoryItem = {
  name: string
  sku: string
  qtyLabel: string
  statusLabel: string
  status: 'critical' | 'low' | 'ok'
  levelPct: number
}

type LowStockAlert = {
  id: string
  status: string
  quantity: number
  threshold: number
  productName: string
  sku: string | null
  createdAt: string
  dustResponse: string | null
  proposedSolution: string | null
  errorMessage: string | null
}

const BASIC_ORDERS: Order[] = [
  { id: '#ORDER-884', product: '1 Oak Table', status: 'Processing', origin: 'Annecy, FR', destination: 'Lyon, FR', eta: 'Nov 22', carrier: 'Colissimo Eco', co2: '12 kg', stock: '3 left' },
  { id: '#ORDER-880', product: '2 Dining Chairs', status: 'Delivered', origin: 'Chambéry, FR', destination: 'Paris, FR', eta: 'Nov 18', carrier: 'Chronopost', co2: '24 kg', stock: 'In Stock' },
  { id: '#ORDER-876', product: '3 Bar Stools', status: 'In Transit', origin: 'Annecy, FR', destination: 'Nice, FR', eta: 'Nov 21', carrier: 'Colissimo Eco', co2: '18 kg', stock: '5 left' },
  { id: '#ORDER-871', product: '1 Bookshelf', status: 'Delivered', origin: 'Albertville, FR', destination: 'Toulouse, FR', eta: 'Nov 16', carrier: 'Colis Privé', co2: '8 kg', stock: 'In Stock' },
]

const PRO_ORDERS: Order[] = [
  { id: '#ORDER-883', product: '50 Oak Tables', status: 'Blocked', origin: 'Shanghai, CN', destination: 'Marseille, FR', eta: 'Delayed', carrier: 'DHL', co2: '1.8 tons', stock: 'Critical' },
  { id: '#ORDER-877', product: '120 Sofas', status: 'In Transit', origin: 'Rotterdam, NL', destination: 'Lyon, FR', eta: 'Nov 20', carrier: 'Truck LTL', co2: '85 kg', stock: 'Healthy' },
  { id: '#ORDER-864', product: '30 Dining Sets', status: 'Delivered', origin: 'Shenzhen, CN', destination: 'Frankfurt, DE', eta: 'Nov 14', carrier: 'Air Freight', co2: '4.2 tons', stock: 'Healthy' },
  { id: '#ORDER-859', product: '80 Bar Stools', status: 'Processing', origin: 'Hamburg, DE', destination: 'Nice, FR', eta: 'Nov 28', carrier: 'Truck FTL', co2: '320 kg', stock: 'Medium' },
]

const BASIC_INVENTORY: InventoryItem[] = [
  { name: 'Oak Tables', sku: 'SKU-OAK-01', qtyLabel: '4 left', statusLabel: 'Low Stock', status: 'low', levelPct: 20 },
  { name: 'Pine Shelves', sku: 'SKU-PIN-03', qtyLabel: '18 left', statusLabel: 'In Stock', status: 'ok', levelPct: 90 },
  { name: 'Walnut Chairs', sku: 'SKU-WAL-07', qtyLabel: '2 left', statusLabel: 'Critical', status: 'critical', levelPct: 10 },
  { name: 'Birch Desks', sku: 'SKU-BIR-02', qtyLabel: '11 left', statusLabel: 'In Stock', status: 'ok', levelPct: 55 },
]

const PRO_INVENTORY: InventoryItem[] = [
  { name: 'Oak Tables', sku: 'SKU-OAK-01', qtyLabel: '125 total', statusLabel: 'Critical', status: 'critical', levelPct: 25 },
  { name: 'Pine Shelves', sku: 'SKU-PIN-03', qtyLabel: '450 total', statusLabel: 'In Stock', status: 'ok', levelPct: 90 },
  { name: 'Walnut Chairs', sku: 'SKU-WAL-07', qtyLabel: '80 total', statusLabel: 'Rebalancing', status: 'low', levelPct: 35 },
  { name: 'Birch Desks', sku: 'SKU-BIR-02', qtyLabel: '210 total', statusLabel: 'In Stock', status: 'ok', levelPct: 70 },
]

const CITY_COORDINATES: Record<string, [number, number]> = {
  'Annecy, FR': [6.1294, 45.8992],
  'Lyon, FR': [4.8357, 45.764],
  'Chambéry, FR': [5.9178, 45.5646],
  'Paris, FR': [2.3522, 48.8566],
  'Nice, FR': [7.262, 43.7102],
  'Albertville, FR': [6.3928, 45.675],
  'Toulouse, FR': [1.4442, 43.6047],
  'Shanghai, CN': [121.4737, 31.2304],
  'Marseille, FR': [5.3698, 43.2965],
  'Rotterdam, NL': [4.4792, 51.9244],
  'Shenzhen, CN': [114.0579, 22.5431],
  'Frankfurt, DE': [8.6821, 50.1109],
  'Hamburg, DE': [9.9937, 53.5511],
}

function toShipmentStatus(status: Order['status']): ShipmentStatus {
  if (status === 'Blocked') return 'blocked'
  if (status === 'In Transit') return 'in_transit'
  if (status === 'Processing') return 'rerouted'
  return 'on_track'
}

function toIsoEta(value: string) {
  if (value.toLowerCase().includes('delayed')) {
    return new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString()
  }
  const parsed = Date.parse(`${value}, 2026`)
  if (Number.isNaN(parsed)) return new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
  return new Date(parsed).toISOString()
}

function parseCo2ToTons(co2: string) {
  const normalized = co2.toLowerCase().trim()
  if (normalized.includes('ton')) {
    const value = Number.parseFloat(normalized.replace(/[^0-9.]/g, ''))
    return Number.isFinite(value) ? value : 1
  }
  const kg = Number.parseFloat(normalized.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(kg)) return 1
  return Number((kg / 1000).toFixed(2))
}

function orderToShipment(order: Order): Shipment {
  const fallback: [number, number] = [2.3522, 48.8566]

  return {
    id: order.id,
    product: order.product,
    origin: {
      name: order.origin,
      coordinates: CITY_COORDINATES[order.origin] ?? fallback,
    },
    destination: {
      name: order.destination,
      coordinates: CITY_COORDINATES[order.destination] ?? fallback,
    },
    status: toShipmentStatus(order.status),
    eta: toIsoEta(order.eta),
    freight: order.carrier,
    cost: 2200 + order.product.length * 110,
    co2: parseCo2ToTons(order.co2),
  }
}

function statusStyle(status: Order['status']) {
  if (status === 'Delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'In Transit') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'Blocked') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-indigo-200 bg-indigo-50 text-indigo-700'
}

function inventoryTone(status: InventoryItem['status']) {
  if (status === 'critical') {
    return {
      chip: 'border-rose-200 bg-rose-50 text-rose-700',
      qty: 'text-rose-700',
      bar: 'bg-rose-500',
    }
  }
  if (status === 'low') {
    return {
      chip: 'border-amber-200 bg-amber-50 text-amber-700',
      qty: 'text-amber-700',
      bar: 'bg-amber-500',
    }
  }
  return {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    qty: 'text-emerald-700',
    bar: 'bg-emerald-500',
  }
}

function lowStockStatusClass(status: string) {
  if (status === 'review_ready') return 'bg-emerald-50 text-emerald-700'
  if (status === 'failed') return 'bg-rose-50 text-rose-700'
  if (status === 'processing') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

export default function DashboardPage() {
  const { isProPluginActive } = usePluginContext()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [lowStockLoading, setLowStockLoading] = useState(true)
  const isPro = isProPluginActive
  const orders = isPro ? PRO_ORDERS : BASIC_ORDERS
  const trackerShipments = useMemo(() => orders.map(orderToShipment), [orders])
  const inventory = isPro ? PRO_INVENTORY : BASIC_INVENTORY
  const alertCount = inventory.filter((item) => item.status !== 'ok').length
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

  useEffect(() => {
    setSelectedOrderId((current) => {
      if (current && orders.some((order) => order.id === current)) return current
      return orders[0]?.id ?? null
    })
  }, [orders])

  useEffect(() => {
    let active = true

    async function loadLowStockAlerts() {
      try {
        const response = await fetch('/api/low-stock-alerts', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load low-stock alerts')
        }

        if (active) {
          setLowStockAlerts(Array.isArray(payload.alerts) ? payload.alerts : [])
        }
      } catch (error) {
        console.error('Failed to load low-stock alerts:', error)
        if (active) {
          setLowStockAlerts([])
        }
      } finally {
        if (active) {
          setLowStockLoading(false)
        }
      }
    }

    loadLowStockAlerts()

    return () => {
      active = false
    }
  }, [])

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

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">Inventory Alerts</h2>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
              {alertCount} alerts
            </span>
          </div>

          <div className="space-y-3">
            {inventory.map((item) => {
              const tone = inventoryTone(item.status)

              return (
                <div key={item.sku}>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {item.name}{' '}
                      <span className="text-sm font-medium text-slate-500">{item.sku}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-semibold ${tone.qty}`}>{item.qtyLabel}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                        {item.statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${tone.bar}`} style={{ width: `${item.levelPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">Low Stock Dust Trigger</h2>
              <p className="mt-1 text-sm text-slate-500">
                Trigger threshold rule: max(min_quantity, 10)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {lowStockLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Loading low-stock alerts...
              </div>
            ) : lowStockAlerts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No low-stock alerts yet. Update stock below threshold to trigger Dust analysis.
              </div>
            ) : (
              lowStockAlerts.map((alert) => (
                <article key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{alert.productName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Qty {alert.quantity} / Threshold {alert.threshold}
                        {alert.sku ? ` • SKU ${alert.sku}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${lowStockStatusClass(alert.status)}`}>
                      {alert.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-700">
                    <span className="font-medium">Agent analysis:</span>{' '}
                    {alert.dustResponse || (alert.status === 'failed' ? alert.errorMessage : 'Pending analysis...')}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Proposed solution:</span>{' '}
                    {alert.proposedSolution || 'Will be provided after analysis.'}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        {isPro && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <GlobalShipmentTracker
              shipments={trackerShipments}
              selectedShipmentId={selectedOrderId ?? undefined}
              onShipmentSelect={(id) => setSelectedOrderId(id)}
              height={340}
            />
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
                  <th className="px-4 py-3">Carrier</th>
                  <th className="px-4 py-3">CO₂</th>
                  <th className="px-4 py-3">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    aria-selected={selectedOrderId === order.id}
                    className={`cursor-pointer transition-colors ${
                      selectedOrderId === order.id
                        ? 'bg-indigo-50/70'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
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
                    <td className="px-4 py-4 text-slate-700">{order.carrier}</td>
                    <td className="px-4 py-4 font-medium text-emerald-700">{order.co2}</td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{order.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

    </div>
  )
}
