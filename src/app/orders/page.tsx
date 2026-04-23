'use client'

import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const stats = [
  { label: 'IN TRANSIT', value: '128', color: 'text-[#2764FF]', badge: '89%', badgeBg: 'bg-[#2764FF]/10 text-[#2764FF]' },
  { label: 'DELIVERED (24H)', value: '342', color: 'text-[#3FA46A]', badge: '↑4%', badgeBg: 'bg-[#3FA46A]/10 text-[#3FA46A]' },
  { label: 'PROCESSING', value: '56', color: 'text-[#03182F]', badge: 'AVG', badgeBg: 'bg-[#F2F8FF] text-[#6B7480]' },
]

const orders = [
  {
    marketplace: 'Amazon DE',
    mpColor: 'bg-[#03182F]',
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
    statusStyle: 'bg-[#F2F8FF] text-[#2764FF]',
    items: 1,
    value: '€89.50',
  },
  {
    marketplace: 'Zalando FR',
    mpColor: 'bg-[#770031]',
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
    mpColor: 'bg-[#03182F]',
    mpCode: 'AMZ',
    orderId: '#ORD-66231-PP',
    date: 'Nov 14, 2023',
    status: 'Processing',
    statusStyle: 'bg-[#F2F8FF] text-[#6B7480]',
    items: 1,
    value: '€55.00',
  },
]

const logFeed = [
  { color: 'bg-[#3FA46A]', time: '14:02:11', text: 'Carrier picked up #ORD-88271-AA from Warehouse A.', pulse: false },
  { color: 'bg-[#F22E75]', time: '13:58:45', text: 'Payment verification failed for #ORD-99210-XC (AMZ DE).', pulse: true },
  { color: 'bg-[#2764FF]', time: '13:45:02', text: 'Label generated for #ORD-22109-BY via DHL Express.', pulse: false },
]

const headlineKpis = [
  { label: 'Visits', value: 780, suffix: '', delta: -1.5, tone: 'neutral' },
  { label: 'Total Sales', value: 210, suffix: ' €', delta: 0, tone: 'neutral' },
  { label: 'Orders', value: 1, suffix: '', delta: 0, tone: 'neutral' },
  { label: 'Conversion Rate', value: 0, suffix: ' %', delta: -100, tone: 'alert' },
]

const financialKpis = [
  {
    title: 'Revenue 2026 (excl. VAT)',
    value: 375000,
    previousLabel: 'Revenue N-1',
    previousValue: 677600,
    delta: -45,
  },
  {
    title: 'Revenue April 2026 (excl. VAT)',
    value: 76700,
    previousLabel: 'Revenue M-1',
    previousValue: 52400,
    delta: 46,
  },
  {
    title: 'Margin 2026',
    value: 174500,
    subRatio: '47%',
    previousLabel: 'Margin N-1',
    previousValue: 124100,
    delta: 41,
  },
  {
    title: 'Margin April 2026',
    value: 36780,
    subRatio: '48%',
    previousLabel: 'Margin M-1',
    previousValue: 28187,
    delta: 30,
  },
]

const cashFlowKpis = [
  {
    label: 'Collected in April',
    value: 340,
    previousLabel: 'March',
    previousValue: 44468,
    tone: 'positive',
  },
  {
    label: 'Disbursed in April',
    value: 0,
    previousLabel: 'March',
    previousValue: 0,
    tone: 'negative',
  },
]

const outstandingBalances = [
  {
    label: 'Customer Receivables',
    value: 189200,
    overdueLabel: 'Overdue',
    overdueValue: 78500,
    tone: 'primary',
  },
  {
    label: 'Supplier Payables',
    value: 31798,
    overdueLabel: 'Due now',
    overdueValue: 31798,
    tone: 'secondary',
  },
]

const trafficTrendData = [
  { date: '24 Mar', current: 26, previous: 1 },
  { date: '27 Mar', current: 7, previous: 112 },
  { date: '30 Mar', current: 39, previous: 18 },
  { date: '2 Apr', current: 72, previous: 37 },
  { date: '5 Apr', current: 41, previous: 20 },
  { date: '8 Apr', current: 73, previous: 25 },
  { date: '11 Apr', current: 52, previous: 64 },
  { date: '14 Apr', current: 24, previous: 39 },
  { date: '17 Apr', current: 49, previous: 24 },
  { date: '20 Apr', current: 10, previous: 19 },
  { date: '23 Apr', current: 14, previous: 8 },
]

const marketplaceRevenueData = [
  { name: 'Amazon', revenue: 12800, fill: '#2764FF' },
  { name: 'Bol.com', revenue: 6900, fill: '#3FA46A' },
  { name: 'Zalando', revenue: 4300, fill: '#E0A93A' },
  { name: 'Fnac', revenue: 2800, fill: '#F22E75' },
]

const amazonStats = [
  { label: 'IN TRANSIT', value: '64', color: 'text-[#2764FF]', badge: '92%', badgeBg: 'bg-[#2764FF]/10 text-[#2764FF]' },
  { label: 'DELIVERED (24H)', value: '144', color: 'text-[#3FA46A]', badge: '↑7%', badgeBg: 'bg-[#3FA46A]/10 text-[#3FA46A]' },
  { label: 'PROCESSING', value: '21', color: 'text-[#03182F]', badge: 'FAST', badgeBg: 'bg-[#F2F8FF] text-[#6B7480]' },
]

const amazonOrders = [
  {
    marketplace: 'Amazon DE',
    mpColor: 'bg-[#03182F]',
    mpCode: 'AMZ',
    orderId: '#AMZ-15423',
    date: 'Today, 11:08 AM',
    status: 'Action Required',
    statusStyle: 'bg-[#FFE7EC] text-[#F22E75]',
    items: 2,
    value: '€219.00',
  },
  {
    marketplace: 'Amazon FR',
    mpColor: 'bg-[#03182F]',
    mpCode: 'AMZ',
    orderId: '#AMZ-15422',
    date: 'Today, 09:41 AM',
    status: 'Processing',
    statusStyle: 'bg-[#F2F8FF] text-[#6B7480]',
    items: 1,
    value: '€58.90',
  },
  {
    marketplace: 'Amazon ES',
    mpColor: 'bg-[#03182F]',
    mpCode: 'AMZ',
    orderId: '#AMZ-15418',
    date: 'Yesterday, 5:21 PM',
    status: 'Shipped',
    statusStyle: 'bg-[#F2F8FF] text-[#2764FF]',
    items: 3,
    value: '€341.45',
  },
]

const amazonLogFeed = [
  { color: 'bg-[#2764FF]', time: '14:12:03', text: 'Amazon FR label generated for #AMZ-15423.', pulse: false },
  { color: 'bg-[#F22E75]', time: '13:56:40', text: 'Amazon DE payment issue detected for #AMZ-15422.', pulse: true },
  { color: 'bg-[#3FA46A]', time: '13:32:18', text: 'Amazon ES parcel handed to DHL.', pulse: false },
]

const shopifyStats = [
  { label: 'IN TRANSIT', value: '41', color: 'text-[#2764FF]', badge: '94%', badgeBg: 'bg-[#2764FF]/10 text-[#2764FF]' },
  { label: 'DELIVERED (24H)', value: '88', color: 'text-[#3FA46A]', badge: '↑11%', badgeBg: 'bg-[#3FA46A]/10 text-[#3FA46A]' },
  { label: 'PROCESSING', value: '12', color: 'text-[#03182F]', badge: 'AVG', badgeBg: 'bg-[#F2F8FF] text-[#6B7480]' },
]

const shopifyOrders = [
  {
    marketplace: 'Shopify FR',
    mpColor: 'bg-[#3FA46A]',
    mpCode: 'SHP',
    orderId: '#SHP-20431',
    date: 'Today, 10:02 AM',
    status: 'Processing',
    statusStyle: 'bg-[#F2F8FF] text-[#6B7480]',
    items: 2,
    value: '€124.00',
  },
  {
    marketplace: 'Shopify US',
    mpColor: 'bg-[#3FA46A]',
    mpCode: 'SHP',
    orderId: '#SHP-20430',
    date: 'Today, 8:47 AM',
    status: 'Shipped',
    statusStyle: 'bg-[#F2F8FF] text-[#2764FF]',
    items: 1,
    value: '€72.99',
  },
  {
    marketplace: 'Shopify UK',
    mpColor: 'bg-[#3FA46A]',
    mpCode: 'SHP',
    orderId: '#SHP-20426',
    date: 'Yesterday, 6:13 PM',
    status: 'Delivered',
    statusStyle: 'bg-[#3FA46A]/10 text-[#3FA46A] border border-[#3FA46A]/10',
    items: 4,
    value: '€389.70',
  },
]

const shopifyLogFeed = [
  { color: 'bg-[#3FA46A]', time: '14:09:27', text: 'Shopify FR order #SHP-20431 confirmed and packed.', pulse: false },
  { color: 'bg-[#2764FF]', time: '13:43:59', text: 'Tracking pushed to Shopify for #SHP-20430.', pulse: false },
  { color: 'bg-[#F22E75]', time: '13:19:08', text: 'Address validation requested for #SHP-20426.', pulse: true },
]

const SOURCE_OPTIONS = [
  { key: 'all', label: 'All Sources' },
  { key: 'amazon', label: 'Amazon' },
  { key: 'shopify', label: 'Shopify' },
] as const

const SOURCE_DATA = {
  all: {
    sourceLabel: 'All Sources',
    stats,
    orders,
    ordersCount: 2451,
    logFeed,
    headlineKpis,
    financialKpis,
    cashFlowKpis,
    outstandingBalances,
    trafficTrendData,
    marketplaceRevenueData,
    currentPeriodLabel: '24 Mar to 23 Apr 2026',
    previousPeriodLabel: '21 Feb to 23 Mar 2026',
    quickDecisionTitle: 'Restock Alert: Best Seller',
    quickDecisionText: '"Modern Ceramic Vase" inventory below 10% on Amazon DE. Orders may stall.',
  },
  amazon: {
    sourceLabel: 'Amazon',
    stats: amazonStats,
    orders: amazonOrders,
    ordersCount: 1028,
    logFeed: amazonLogFeed,
    headlineKpis: [
      { label: 'Visits', value: 431, suffix: '', delta: -0.8, tone: 'neutral' },
      { label: 'Total Sales', value: 154, suffix: ' €', delta: 8.4, tone: 'positive' },
      { label: 'Orders', value: 3, suffix: '', delta: 6.7, tone: 'positive' },
      { label: 'Conversion Rate', value: 1.2, suffix: ' %', delta: 2.1, tone: 'positive' },
    ],
    financialKpis: [
      { title: 'Revenue 2026 (excl. VAT)', value: 242100, previousLabel: 'Revenue N-1', previousValue: 311200, delta: -22 },
      { title: 'Revenue April 2026 (excl. VAT)', value: 52300, previousLabel: 'Revenue M-1', previousValue: 41600, delta: 25 },
      { title: 'Margin 2026', value: 102900, subRatio: '42%', previousLabel: 'Margin N-1', previousValue: 95400, delta: 8 },
      { title: 'Margin April 2026', value: 23120, subRatio: '44%', previousLabel: 'Margin M-1', previousValue: 17140, delta: 35 },
    ],
    cashFlowKpis: [
      { label: 'Collected in April', value: 12120, previousLabel: 'March', previousValue: 10440, tone: 'positive' },
      { label: 'Disbursed in April', value: 3180, previousLabel: 'March', previousValue: 4100, tone: 'negative' },
    ],
    outstandingBalances: [
      { label: 'Customer Receivables', value: 81200, overdueLabel: 'Overdue', overdueValue: 22900, tone: 'primary' },
      { label: 'Supplier Payables', value: 14390, overdueLabel: 'Due now', overdueValue: 11320, tone: 'secondary' },
    ],
    trafficTrendData: [
      { date: '24 Mar', current: 18, previous: 10 },
      { date: '27 Mar', current: 26, previous: 24 },
      { date: '30 Mar', current: 29, previous: 20 },
      { date: '2 Apr', current: 48, previous: 32 },
      { date: '5 Apr', current: 34, previous: 27 },
      { date: '8 Apr', current: 52, previous: 39 },
      { date: '11 Apr', current: 45, previous: 35 },
      { date: '14 Apr', current: 20, previous: 28 },
      { date: '17 Apr', current: 39, previous: 25 },
      { date: '20 Apr', current: 16, previous: 18 },
      { date: '23 Apr', current: 24, previous: 21 },
    ],
    marketplaceRevenueData: [
      { name: 'Amazon DE', revenue: 19200, fill: '#03182F' },
      { name: 'Amazon FR', revenue: 15300, fill: '#2764FF' },
      { name: 'Amazon ES', revenue: 9800, fill: '#3FA46A' },
      { name: 'Amazon IT', revenue: 6300, fill: '#E0A93A' },
    ],
    currentPeriodLabel: 'Amazon: 24 Mar to 23 Apr 2026',
    previousPeriodLabel: 'Amazon: 21 Feb to 23 Mar 2026',
    quickDecisionTitle: 'Amazon Restock Risk',
    quickDecisionText: '"Smart LED Strip" is below reorder point in Amazon DE and FR.',
  },
  shopify: {
    sourceLabel: 'Shopify',
    stats: shopifyStats,
    orders: shopifyOrders,
    ordersCount: 612,
    logFeed: shopifyLogFeed,
    headlineKpis: [
      { label: 'Visits', value: 349, suffix: '', delta: 3.1, tone: 'positive' },
      { label: 'Total Sales', value: 286, suffix: ' €', delta: 6.8, tone: 'positive' },
      { label: 'Orders', value: 5, suffix: '', delta: 12.2, tone: 'positive' },
      { label: 'Conversion Rate', value: 1.4, suffix: ' %', delta: 4.6, tone: 'positive' },
    ],
    financialKpis: [
      { title: 'Revenue 2026 (excl. VAT)', value: 132900, previousLabel: 'Revenue N-1', previousValue: 120500, delta: 10 },
      { title: 'Revenue April 2026 (excl. VAT)', value: 29800, previousLabel: 'Revenue M-1', previousValue: 21400, delta: 39 },
      { title: 'Margin 2026', value: 71600, subRatio: '54%', previousLabel: 'Margin N-1', previousValue: 58000, delta: 23 },
      { title: 'Margin April 2026', value: 13660, subRatio: '46%', previousLabel: 'Margin M-1', previousValue: 9800, delta: 39 },
    ],
    cashFlowKpis: [
      { label: 'Collected in April', value: 18440, previousLabel: 'March', previousValue: 12950, tone: 'positive' },
      { label: 'Disbursed in April', value: 5410, previousLabel: 'March', previousValue: 6020, tone: 'negative' },
    ],
    outstandingBalances: [
      { label: 'Customer Receivables', value: 47200, overdueLabel: 'Overdue', overdueValue: 9800, tone: 'primary' },
      { label: 'Supplier Payables', value: 8920, overdueLabel: 'Due now', overdueValue: 7650, tone: 'secondary' },
    ],
    trafficTrendData: [
      { date: '24 Mar', current: 8, previous: 6 },
      { date: '27 Mar', current: 13, previous: 9 },
      { date: '30 Mar', current: 21, previous: 11 },
      { date: '2 Apr', current: 25, previous: 16 },
      { date: '5 Apr', current: 22, previous: 15 },
      { date: '8 Apr', current: 27, previous: 19 },
      { date: '11 Apr', current: 18, previous: 14 },
      { date: '14 Apr', current: 14, previous: 9 },
      { date: '17 Apr', current: 19, previous: 11 },
      { date: '20 Apr', current: 9, previous: 8 },
      { date: '23 Apr', current: 12, previous: 7 },
    ],
    marketplaceRevenueData: [
      { name: 'Shopify FR', revenue: 11800, fill: '#3FA46A' },
      { name: 'Shopify US', revenue: 9200, fill: '#2764FF' },
      { name: 'Shopify UK', revenue: 7600, fill: '#E0A93A' },
      { name: 'Shopify EU', revenue: 5400, fill: '#F22E75' },
    ],
    currentPeriodLabel: 'Shopify: 24 Mar to 23 Apr 2026',
    previousPeriodLabel: 'Shopify: 21 Feb to 23 Mar 2026',
    quickDecisionTitle: 'Shopify Demand Spike',
    quickDecisionText: '"Wireless Charger Duo" has rising sales velocity; forecast a 6-day stockout.',
  },
}

type SourceKey = keyof typeof SOURCE_DATA

function formatNumber(value: number, maxFractionDigits = 1) {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const rounded = Number.isInteger(abs)
    ? abs.toString()
    : abs
        .toFixed(maxFractionDigits)
        .replace(/\.0+$/, '')
        .replace(/(\.\d*[1-9])0+$/, '$1')

  const [intPart, fractionPart] = rounded.split('.')
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  return fractionPart
    ? `${sign}${intFormatted},${fractionPart}`
    : `${sign}${intFormatted}`
}

function formatCurrency(value: number) {
  return `${formatNumber(value, 2)} €`
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}%`
  if (delta < 0) return `${delta}%`
  return '0%'
}

function formatAmount(amount: number) {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)

  if (abs >= 1_000_000) {
    return `${sign}${formatNumber(abs / 1_000_000, 1)} M €`
  }

  if (abs >= 1_000) {
    return `${sign}${formatNumber(abs / 1_000, 1)} k €`
  }

  return `${sign}${formatNumber(abs, 0)} €`
}

export default function OrdersPage() {
  const [selectedSource, setSelectedSource] = useState<SourceKey>('all')
  const selectedData = SOURCE_DATA[selectedSource]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Orders</h1>
          <p className="font-serif text-[13px] text-[#6B7480] mt-1 italic">Real-time fulfillment operations and logistics hub.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map((source) => {
              const active = source.key === selectedSource
              return (
                <button
                  key={source.key}
                  type="button"
                  onClick={() => setSelectedSource(source.key)}
                  className={`h-8 rounded-full px-3 font-serif text-[12px] font-bold transition-colors ${
                    active ? 'bg-[#2764FF] text-white' : 'bg-white text-[#30373E] border border-[#DDE5EE] hover:bg-[#F2F8FF]'
                  }`}
                >
                  {source.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7480]" />
            <input
              className="pl-10 pr-4 h-9 w-64 bg-white border border-[#DDE5EE] rounded font-serif text-[13px] focus:ring-1 focus:ring-[#2764FF] focus:border-[#2764FF] outline-none"
              placeholder={`Search ${selectedData.sourceLabel.toLowerCase()} orders...`}
              type="text"
            />
          </div>
          <button className="h-9 px-4 border border-[#BFCBDA] rounded flex items-center gap-2 bg-white font-serif text-[13px] font-bold hover:bg-[#F2F8FF] transition-colors">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </button>
          <button className="h-9 px-4 bg-[#2764FF] text-white rounded font-serif text-[13px] font-bold hover:opacity-90 transition-opacity">
            Export Report
          </button>
        </div>
      </div>

      {/* Key Indicators */}
      <div className="space-y-4">
        <div className="bg-white border border-[#DDE5EE] rounded-xl p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            {selectedData.headlineKpis.map((kpi) => {
              const isPositive = kpi.delta > 0
              const isNegative = kpi.delta < 0
              return (
                <div key={kpi.label} className="rounded-lg border border-[#DDE5EE] bg-[#F2F8FF] p-4">
                  <p className="font-serif text-[12px] font-bold text-[#30373E]">{kpi.label}</p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="font-serif text-[40px] leading-none font-bold tracking-tight text-[#03182F]">
                      {formatNumber(kpi.value)}
                      {kpi.suffix}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${
                        isPositive ? 'text-[#3FA46A] bg-[#3FA46A]/10' : isNegative ? 'text-[#ba1a1a] bg-[#ba1a1a]/10' : 'text-[#6B7480] bg-[#F2F8FF]'
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : null}
                      {isNegative ? <ArrowDownRight className="h-3 w-3" /> : null}
                      {formatDelta(kpi.delta)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedData.trafficTrendData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#DDE5EE" vertical={false} />
                <XAxis dataKey="date" stroke="#6B7480" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontFamily: 'var(--font-roboto-serif)' }} />
                <YAxis stroke="#6B7480" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontFamily: 'var(--font-roboto-serif)' }} width={36} />
                <Tooltip
                  cursor={{ stroke: '#DDE5EE', strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const current = payload.find((item) => item.dataKey === 'current')?.value
                    const previous = payload.find((item) => item.dataKey === 'previous')?.value
                    return (
                      <div className="rounded-lg border border-[#DDE5EE] bg-white px-3 py-2 shadow-sm">
                        <p className="font-serif text-[12px] font-bold text-[#03182F]">{label}</p>
                        <p className="font-serif text-[12px] text-[#2764FF]">Current: {current}</p>
                        <p className="font-serif text-[12px] text-[#6B7480]">Previous: {previous}</p>
                      </div>
                    )
                  }}
                />
                <Line type="monotone" dataKey="current" stroke="#2764FF" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="previous" stroke="#6B7480" strokeWidth={3} strokeDasharray="5 6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap gap-6 px-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2764FF]" />
              <span className="font-serif text-[12px] text-[#6B7480]">{selectedData.currentPeriodLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6B7480]" />
              <span className="font-serif text-[12px] text-[#6B7480]">{selectedData.previousPeriodLabel}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8 bg-white border border-[#DDE5EE] rounded-xl p-4 sm:p-6">
            <h3 className="font-serif text-[18px] font-bold text-[#03182F] mb-4">Financial Highlights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedData.financialKpis.map((kpi) => {
                const positive = kpi.delta >= 0
                return (
                  <div key={kpi.title} className="rounded-xl border border-dashed border-[#DDE5EE] p-4">
                    <p className="font-serif text-[13px] text-[#30373E]">{kpi.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">{formatAmount(kpi.value)}</span>
                      {kpi.subRatio ? <span className="font-serif text-[16px] text-[#30373E]">({kpi.subRatio})</span> : null}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold ${
                          positive ? 'bg-[#3FA46A]/10 text-[#3FA46A]' : 'bg-[#FFE7EC] text-[#ba1a1a]'
                        }`}
                      >
                        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(kpi.delta)}%
                      </span>
                    </div>
                    <p className="mt-3 font-serif text-[13px] text-[#6B7480]">
                      {kpi.previousLabel}:{' '}
                      <span className="font-bold text-[#30373E]">{formatAmount(kpi.previousValue)}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="xl:col-span-4 bg-white border border-[#DDE5EE] rounded-xl p-4 sm:p-6">
            <h3 className="font-serif text-[18px] font-bold text-[#03182F] mb-4">{selectedData.sourceLabel} Revenue</h3>
            <div className="h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedData.marketplaceRevenueData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDE5EE" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'var(--font-roboto-serif)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'var(--font-roboto-serif)' }} tickLine={false} axisLine={false} width={38} />
                  <Tooltip
                    cursor={{ fill: '#F2F8FF' }}
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label: string) => `${label}`}
                    contentStyle={{ fontFamily: 'var(--font-roboto-serif)' }}
                    labelStyle={{ fontFamily: 'var(--font-roboto-serif)' }}
                    itemStyle={{ fontFamily: 'var(--font-roboto-serif)' }}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {selectedData.marketplaceRevenueData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedData.cashFlowKpis.map((item) => {
            return (
              <div key={item.label} className="bg-white border border-dashed border-[#DDE5EE] rounded-xl p-4 sm:p-6">
                <p className="font-serif text-[17px] text-[#30373E]">{item.label}</p>
                <p className="mt-2 font-serif text-[56px] leading-none tracking-tight font-bold text-[#03182F]">
                  {formatAmount(item.value)}
                </p>
                <p className="mt-2 font-serif text-[14px] text-[#6B7480]">
                  ({formatAmount(item.previousValue)} {item.previousLabel})
                </p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedData.outstandingBalances.map((item) => (
            <div key={item.label} className="bg-white border border-dashed border-[#DDE5EE] rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="font-serif text-[17px] text-[#30373E]">{item.label}</p>
                <button className="font-serif text-[13px] text-[#2764FF] hover:underline">View all</button>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <span className="font-serif text-[58px] leading-none tracking-tight font-bold text-[#03182F]">
                  {formatAmount(item.value)}
                </span>
                <span className="font-serif text-[36px] leading-none tracking-tight text-[#03182F]">
                  {item.overdueLabel}: {formatAmount(item.overdueValue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {selectedData.stats.map((s) => (
          <div key={s.label} className="p-6 bg-white border border-[#DDE5EE] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase block mb-2">{s.label}</span>
            <div className="flex items-end justify-between">
              <span className="font-serif text-[44px] font-bold leading-none tracking-tight italic text-[#03182F]">{s.value}</span>
              <div className={`w-12 h-6 rounded flex items-center justify-center ${s.badgeBg}`}>
                <span className="text-[10px] font-serif">{s.badge}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#DDE5EE] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#F2F8FF] border-b border-[#DDE5EE]">
            <tr>
              {['Marketplace', 'Order ID & Date', 'Status', 'Items', 'Value'].map((h, i) => (
                <th key={h} className={`px-6 py-4 font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase ${i === 4 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE5EE]">
            {selectedData.orders.map((o) => (
              <tr key={o.orderId} className="hover:bg-[#F2F8FF] transition-colors cursor-pointer">
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
                    <span className="font-serif text-[12px] font-bold text-[#03182F]">{o.orderId}</span>
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
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-[#F2F8FF]" />
                    {o.items > 1 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-[#F2F8FF] flex items-center justify-center">
                        <span className="text-[10px] font-serif text-[#6B7480]">+{o.items - 1}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-serif text-[13px] font-bold">{o.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-6 py-4 bg-white border-t border-[#DDE5EE] flex items-center justify-between">
          <span className="font-serif text-[12px] text-[#6B7480]">
            Showing <span className="font-bold">1-{selectedData.orders.length}</span> of <span className="font-bold">{formatNumber(selectedData.ordersCount, 0)}</span> orders
          </span>
          <div className="flex gap-1">
            <button className="w-8 h-8 rounded border border-[#DDE5EE] flex items-center justify-center text-[#6B7480] hover:bg-[#F2F8FF] transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded bg-[#2764FF] text-white text-[11px] font-bold">1</button>
            <button className="w-8 h-8 rounded border border-[#DDE5EE] text-[11px] font-bold text-[#6B7480] hover:bg-[#F2F8FF] transition-colors">2</button>
            <button className="w-8 h-8 rounded border border-[#DDE5EE] text-[11px] font-bold text-[#6B7480] hover:bg-[#F2F8FF] transition-colors">3</button>
            <button className="w-8 h-8 rounded border border-[#DDE5EE] flex items-center justify-center text-[#6B7480] hover:bg-[#F2F8FF] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Logistics Feed + Quick Decision */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Logistics Feed */}
        <div className="col-span-8 bg-white border border-[#DDE5EE] rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif text-base font-bold text-[#03182F]">Logistics Feed</h3>
            <span className="text-[10px] font-serif uppercase text-[#2764FF] bg-[#F2F8FF] px-2 py-1 rounded">Live Syncing</span>
          </div>
          <div className="space-y-3">
            {selectedData.logFeed.map((l, i) => (
              <div key={i} className="flex items-center h-8 border-b border-[#DDE5EE]">
                <span className={`w-2 h-2 rounded-full ${l.color} mr-4 ${l.pulse ? 'animate-pulse' : ''}`} />
                <span className="font-serif text-[10px] text-[#6B7480] w-20">{l.time}</span>
                <span className="font-serif text-[13px] text-[#03182F]">{l.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Decision */}
        <div className="col-span-4 bg-[#03182F] text-white rounded-lg p-6 flex flex-col justify-between">
          <div>
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase block mb-2">QUICK DECISION</span>
            <h4 className="font-serif text-base font-bold mb-2">{selectedData.quickDecisionTitle}</h4>
            <p className="font-serif text-[12px] text-[#DDE5EE]">{selectedData.quickDecisionText}</p>
          </div>
          <div className="mt-4 space-y-2">
            <button className="w-full h-9 bg-[#2764FF] text-white rounded font-serif text-[13px] font-bold hover:opacity-90">Auto-Replenish</button>
            <button className="w-full h-9 bg-transparent border border-[#BFCBDA] text-white rounded font-serif text-[13px] font-bold hover:bg-[#F2F8FF]/10">Snooze Alert</button>
          </div>
        </div>
      </div>
    </div>
  )
}
