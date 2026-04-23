'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MoreVertical, Plus, RefreshCw, Settings, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { pickConversationName } from '@/lib/marketplaces'

const marketplaces = [
  {
    name: 'Amazon',
    bgColor: 'bg-[#03182F]',
    icon: 'AMZ',
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
    bgColor: 'bg-[#770031]',
    icon: 'RKT',
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
    bgColor: 'bg-[#2764FF]',
    icon: 'CDS',
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
    bgColor: 'bg-[#3FA46A]',
    icon: 'LRY',
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

const conversations = [
  { name: 'Darty', lastMsg: 'LEIA: The category mapping is ready for your review.', time: '14:20', active: true },
  { name: 'Carrefour', lastMsg: 'We are reviewing your luxury goods catalog.', time: 'YESTERDAY', active: false },
  { name: 'Auchan', lastMsg: 'LEIA: Proposal sent for the Q4 integration phase.', time: 'MON', active: false },
  { name: 'ManoMano', lastMsg: 'LEIA: Checking logistics API endpoints.', time: 'OCT 24', active: false },
]

const messages = [
  {
    from: 'partner',
    text: 'Hello Fanny, we reviewed your catalog and would like to discuss a premium placement for the upcoming retail period.',
    time: '10:45 AM',
  },
  {
    from: 'leia',
    text: 'Leia reviewed the proposal. Compatibility is high and the activation path is ready for your approval.',
    time: '11:02 AM · AUTOPILOT',
  },
  {
    from: 'partner',
    text: 'Perfect. We have sent the technical requirements for the API sync and shipping rules.',
    time: '14:15 PM',
  },
]

const requirements = [
  { label: 'Mirakl API Key', status: 'ok' },
  { label: 'Catalog Matching (94%)', status: 'ok' },
  { label: 'Shipping Policy Review', status: 'warn' },
  { label: 'Contract Signature', status: 'pending' },
]

type ShopifyConnectionStatus = {
  id: string
  shopDomain: string
  shopName?: string | null
  status: string
  installedAt?: string | null
  lastSyncedAt?: string | null
  lastWebhookAt?: string | null
  ordersCount: number
}

type ShopifyStatusPayload = {
  connected: boolean
  connections: ShopifyConnectionStatus[]
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ActiveConnectionPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [shopDomain, setShopDomain] = useState('')
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatusPayload | null>(null)
  const [shopifyLoading, setShopifyLoading] = useState(true)
  const [syncingShopify, setSyncingShopify] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [selectedConv, setSelectedConv] = useState(
    pickConversationName(null, conversations.map((conversation) => conversation.name))
  )

  const loadShopifyStatus = useCallback(async () => {
    setShopifyLoading(true)
    try {
      const response = await fetch('/api/integrations/shopify/status', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load Shopify status')
      }
      setShopifyStatus(data)
    } catch (error) {
      console.error('Shopify status error:', error)
      setStatusMessage(error instanceof Error ? error.message : 'Unable to load Shopify status')
    } finally {
      setShopifyLoading(false)
    }
  }, [])

  const hasShopifyConnection = useMemo(
    () => Boolean(shopifyStatus?.connections?.length),
    [shopifyStatus]
  )

  useEffect(() => {
    void loadShopifyStatus()
  }, [loadShopifyStatus])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const partner = params.get('partner')
    setSelectedConv(
      pickConversationName(partner, conversations.map((conversation) => conversation.name))
    )

    const status = params.get('shopify')
    const reason = params.get('reason')

    if (partner && !status) {
      setStatusMessage(`${partner} selected in channels.`)
    }

    if (status === 'connected') {
      setStatusMessage('Shopify connected successfully. Initial sync started.')
      return
    }

    if (status === 'error') {
      setStatusMessage(`Shopify connection failed${reason ? `: ${reason}` : ''}`)
    }
  }, [])

  const focusShopifyInput = () => {
    inputRef.current?.focus()
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleConnectShopify = () => {
    if (!shopDomain.trim()) {
      setStatusMessage('Please enter your Shopify shop domain (example: your-store.myshopify.com).')
      focusShopifyInput()
      return
    }

    window.location.href = `/api/integrations/shopify/install?shop=${encodeURIComponent(
      shopDomain.trim()
    )}`
  }

  const handleSyncShopify = async () => {
    setSyncingShopify(true)
    setStatusMessage(null)
    try {
      const response = await fetch('/api/integrations/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 75 }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Shopify sync failed')
      }

      const syncedOrders = Array.isArray(data.results)
        ? data.results.reduce((acc: number, result: { upserted?: number }) => acc + (result.upserted || 0), 0)
        : 0
      setStatusMessage(`Shopify sync completed: ${syncedOrders} orders updated.`)
      await loadShopifyStatus()
    } catch (error) {
      console.error('Shopify sync error:', error)
      setStatusMessage(error instanceof Error ? error.message : 'Unable to sync Shopify data')
    } finally {
      setSyncingShopify(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">
            Active Marketplace Connections
          </h1>
          <p className="text-[#6B7480] text-sm mt-1">
            Real-time operational status across your global distribution network.
          </p>
        </div>
        <button
          type="button"
          onClick={focusShopifyInput}
          className="h-9 px-4 bg-[#2764FF] text-white text-[13px] font-semibold rounded-lg transition-all duration-150 ease-out hover:bg-[#2764FF]/90 focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Connect New Channel
        </button>
      </div>

      <div className="bg-white border border-[#DDE5EE] rounded-lg p-6 space-y-4 shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-base font-bold text-[#03182F]">Shopify App</h3>
            <p className="text-[13px] text-[#6B7480] mt-1">
              Connect your Shopify store and sync orders into Mirakl Connect.
            </p>
          </div>
          <span
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
              shopifyStatus?.connected
                ? 'bg-[#3FA46A]/10 text-[#3FA46A]'
                : 'bg-[#FFE7EC] text-[#F22E75]'
            }`}
          >
            {shopifyStatus?.connected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="your-store.myshopify.com"
            className="h-10 w-[320px] rounded border border-[#DDE5EE] px-3 font-serif text-[13px] outline-none focus:border-[#2764FF] focus:ring-1 focus:ring-[#2764FF]"
          />
          <button
            type="button"
            onClick={handleConnectShopify}
            className="h-10 px-4 bg-[#2764FF] text-white text-[13px] font-semibold rounded-lg transition-all duration-150 ease-out hover:bg-[#2764FF]/90 focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
          >
            Connect Shopify
          </button>
          <button
            type="button"
            onClick={() => void handleSyncShopify()}
            disabled={!hasShopifyConnection || syncingShopify}
            className="h-10 px-4 border border-[#BFCBDA] text-[#30373E] text-[13px] font-semibold rounded-lg transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncingShopify ? 'animate-spin' : ''}`} />
            Sync Orders
          </button>
          <button
            type="button"
            onClick={() => void loadShopifyStatus()}
            className="h-10 px-4 border border-[#BFCBDA] text-[#30373E] text-[13px] font-semibold rounded-lg transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
          >
            Refresh Status
          </button>
        </div>

        {statusMessage ? (
          <p className="text-[12px] text-[#30373E] bg-[#F2F8FF] border border-[#DDE5EE] rounded px-3 py-2">
            {statusMessage}
          </p>
        ) : null}

        <div className="border border-[#DDE5EE] rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-[#F2F8FF] border-b border-[#DDE5EE] text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">
            Shopify Connections
          </div>
          {shopifyLoading ? (
            <div className="px-4 py-4 text-[13px] text-[#6B7480]">Loading Shopify status...</div>
          ) : shopifyStatus?.connections?.length ? (
            <div className="divide-y divide-[#DDE5EE]">
              {shopifyStatus.connections.map((connection) => (
                <div key={connection.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-serif text-[14px] font-bold text-[#03182F]">
                      {connection.shopName || connection.shopDomain}
                    </p>
                    <p className="text-[12px] text-[#6B7480]">{connection.shopDomain}</p>
                  </div>
                  <div className="text-[12px] text-[#6B7480] flex flex-wrap gap-4">
                    <span>Status: <strong>{connection.status}</strong></span>
                    <span>Orders: <strong>{connection.ordersCount}</strong></span>
                    <span>Last sync: <strong>{formatDateTime(connection.lastSyncedAt)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-[13px] text-[#6B7480]">No Shopify shop connected yet.</div>
          )}
        </div>
      </div>

      <div className="flex border border-[#DDE5EE] bg-white rounded overflow-hidden" style={{ height: 'calc(100vh - 290px)' }}>
        <aside className="w-80 border-r border-[#DDE5EE] flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-[#DDE5EE] bg-[#F2F8FF]/50">
            <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Active Proposals</h3>
          </div>
          <div className="flex-grow">
            {conversations.map((conversation) => (
              <button
                key={conversation.name}
                type="button"
                onClick={() => setSelectedConv(conversation.name)}
                className={`w-full p-4 text-left transition-all duration-150 ease-out ${
                  selectedConv === conversation.name
                    ? 'bg-[#dce1ff]/30 border-l-4 border-[#004bd9]'
                    : 'hover:bg-[#F2F8FF] border-l-4 border-transparent'
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-[#DDE5EE] flex items-center justify-center flex-shrink-0">
                    <Store className="h-5 w-5 text-[#6B7480]" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-serif text-sm font-bold text-[#03182F]">{conversation.name}</span>
                      <span className="text-[10px] font-mono text-[#6B7480] uppercase">{conversation.time}</span>
                    </div>
                    <p className="text-[12px] text-[#6B7480] truncate italic">{conversation.lastMsg}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <article className="flex-grow flex flex-col">
          <header className="p-4 border-b border-[#DDE5EE] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border border-[#DDE5EE] flex items-center justify-center">
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
              <button
                type="button"
                onClick={() => setStatusMessage(`${selectedConv} marked as declined.`)}
                className="h-9 px-4 flex items-center gap-2 border border-[#BFCBDA] text-[#30373E] text-[11px] font-bold rounded transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 uppercase"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setStatusMessage(`${selectedConv} approved for activation.`)}
                className="h-9 px-4 flex items-center gap-2 bg-[#3FA46A] text-white text-[11px] font-bold rounded transition-all duration-150 ease-out hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#3FA46A]/40 uppercase shadow-sm"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={focusShopifyInput}
                className="h-9 px-4 flex items-center gap-2 bg-[#004bd9] text-white text-[11px] font-bold rounded transition-all duration-150 ease-out hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 uppercase shadow-sm"
              >
                Install
              </button>
            </div>
          </header>

          <div className="flex-grow overflow-y-auto p-6 space-y-8 bg-[#faf8ff]">
            {messages.map((message, index) => {
              if (message.from === 'leia') {
                return (
                  <div key={index} className="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-[#03182F] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">AI</div>
                    <div className="space-y-1 text-right">
                      <div className="bg-[#004bd9] text-white p-4 rounded-xl rounded-tr-none shadow-sm">
                        <p className="text-sm">{message.text}</p>
                      </div>
                      <span className="text-[10px] font-mono text-[#6B7480] uppercase mr-1">{message.time}</span>
                    </div>
                  </div>
                )
              }
              return (
                <div key={index} className="flex gap-4 max-w-2xl">
                  <div className="w-8 h-8 rounded-full bg-white border border-[#DDE5EE] flex-shrink-0 flex items-center justify-center">
                    <Store className="h-4 w-4 text-[#6B7480]" />
                  </div>
                  <div className="space-y-1">
                    <div className="bg-white border border-[#DDE5EE] p-4 rounded-xl rounded-tl-none shadow-sm">
                      <p className="text-sm text-[#30373E]">{message.text}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#6B7480] uppercase ml-1">{message.time}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <footer className="p-4 bg-white border-t border-[#DDE5EE] flex-shrink-0">
            <div className="flex gap-3 items-center bg-[#03182F] rounded-full p-1.5 pl-4 shadow-lg">
              <input
                className="flex-grow bg-transparent border-none text-white text-sm focus:ring-0 focus:outline-none placeholder:text-[#6B7480] font-serif"
                placeholder={`Message ${selectedConv} team...`}
                type="text"
                onFocus={() => setStatusMessage(`Compose a reply for ${selectedConv}.`)}
              />
              <button
                type="button"
                onClick={() => setStatusMessage(`Draft queued for ${selectedConv}.`)}
                className="bg-[#004bd9] text-white px-4 h-9 rounded-full flex items-center justify-center transition-all duration-150 ease-out hover:bg-[#2764FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
              >
                Send
              </button>
            </div>
          </footer>
        </article>

        <aside className="w-72 border-l border-[#DDE5EE] flex flex-col overflow-y-auto flex-shrink-0">
          <div className="p-6 space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-lg bg-white border border-[#DDE5EE] shadow-sm mx-auto mb-4 flex items-center justify-center">
                <Store className="h-10 w-10 text-[#6B7480]" />
              </div>
              <h3 className="font-serif text-[22px] font-bold text-[#03182F]">{selectedConv}</h3>
              <p className="text-[12px] text-[#6B7480] mt-1">High-Tech & Electronics Marketplace</p>
            </div>

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

            <div className="space-y-3">
              <h4 className="font-serif text-sm font-bold uppercase text-[#6B7480] tracking-wider">About</h4>
              <p className="text-[13px] text-[#6B7480] leading-relaxed">
                Leading French retailer with a qualified consumer base and a strong merchandising program for premium home categories.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-serif text-sm font-bold uppercase text-[#6B7480] tracking-wider">Requirements</h4>
              <ul className="space-y-2">
                {requirements.map((requirement) => (
                  <li key={requirement.label} className="flex items-start gap-2 text-[13px] text-[#6B7480]">
                    {requirement.status === 'ok' && <span className="text-[#3FA46A] text-base mt-0.5">&#10003;</span>}
                    {requirement.status === 'warn' && <span className="text-[#E0A93A] text-base mt-0.5">&#9888;</span>}
                    {requirement.status === 'pending' && <span className="text-[#BFCBDA] text-base mt-0.5">&#9675;</span>}
                    <span>{requirement.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-[#FFE7EC] rounded-lg border border-[#F22E75]/20">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#F22E75] uppercase block">Risk Signal</span>
              <p className="text-[11px] text-[#F22E75] font-medium mt-1">Pricing for Black Friday must be finalized by Nov 1 to ensure placement.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {marketplaces.map((marketplace) => (
          <div
            key={marketplace.name}
            className="bg-white border border-[#DDE5EE] rounded-lg p-6 transition-all duration-150 ease-out hover:border-[#2764FF]/30 shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${marketplace.bgColor} flex items-center justify-center`}>
                  <span className="text-white text-[11px] font-bold">{marketplace.icon}</span>
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-[#03182F]">{marketplace.name}</h3>
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${marketplace.statusColor}`}>
                    {marketplace.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="text-[#6B7480] transition-all duration-150 ease-out hover:text-[#03182F] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
                aria-label={`Open ${marketplace.name} settings`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase mb-1">
                  Monthly Revenue
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">
                    {marketplace.revenue}
                  </span>
                  <span className={`text-[12px] italic ${marketplace.revenueUp ? 'text-[#3FA46A]' : 'text-[#F22E75]'}`}>
                    {marketplace.revenueChange}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#DDE5EE]">
                <div>
                  <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase mb-1">
                    Items Sold
                  </p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{marketplace.itemsSold}</p>
                </div>
                <div>
                  <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase mb-1">
                    Unique Customers
                  </p>
                  <p className="font-serif text-lg font-bold text-[#03182F]">{marketplace.customers}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <svg className="w-24 h-8 overflow-visible" viewBox="0 0 100 30">
                  <path d={marketplace.sparkPath} fill="none" stroke={marketplace.sparkColor} strokeWidth="1.5" />
                </svg>
                <button
                  type="button"
                  onClick={() => router.push('/orders')}
                  className="text-[#2764FF] text-[13px] font-semibold transition-all duration-150 ease-out hover:underline focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
                >
                  View Ledger
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#DDE5EE] rounded-lg overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
        <div className="px-6 py-4 border-b border-[#DDE5EE] bg-[#F2F8FF] flex justify-between items-center">
          <h3 className="font-serif text-base font-bold text-[#03182F]">API Health & Sync Status</h3>
          <span className="px-2 py-1 bg-[#3FA46A]/10 text-[#3FA46A] text-[10px] font-bold rounded uppercase tracking-wider">
            All Systems Operational
          </span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F2F8FF]">
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
          <tbody className="divide-y divide-[#DDE5EE]">
            {apiRows.map((row) => (
              <tr key={row.name} className="hover:bg-[#F2F8FF] transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-[#03182F]/5 flex items-center justify-center text-[#03182F] text-[10px] font-bold">
                    API
                  </div>
                  <span className="font-serif text-sm font-semibold">{row.name}</span>
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-[#6B7480]">{row.lastSync}</td>
                <td className="px-6 py-4 text-[13px]">{row.latency}</td>
                <td className={`px-6 py-4 text-[13px] ${row.errorColor}`}>{row.errorRate}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => router.push('/settings')}
                    className="text-[#2764FF] transition-all duration-150 ease-out hover:text-[#2764FF]/70 focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
                    aria-label={`Open settings for ${row.name}`}
                  >
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
