export type PresentationOrder = {
  marketplace: string
  mpColor: string
  mpCode: string
  orderId: string
  date: string
  status: string
  statusStyle: string
  items: number
  value: string
}

const csvHeaders = ['Marketplace', 'Order ID', 'Date', 'Status', 'Items', 'Value']

function parseCurrency(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function buildSyntheticDate(cycle: number, index: number, fallback: string) {
  if (cycle === 0) return fallback

  const syntheticDates = [
    'Today, 09:12 AM',
    'Today, 08:41 AM',
    'Yesterday, 06:18 PM',
    'Yesterday, 03:27 PM',
    'Apr 21, 2026',
    'Apr 20, 2026',
    'Apr 19, 2026',
  ]

  return syntheticDates[(cycle + index - 1) % syntheticDates.length]
}

export function expandOrdersDataset(baseOrders: PresentationOrder[], minimumCount = 12) {
  if (baseOrders.length === 0 || minimumCount <= baseOrders.length) {
    return baseOrders
  }

  const expanded = [...baseOrders]

  while (expanded.length < minimumCount) {
    const index = expanded.length
    const base = baseOrders[index % baseOrders.length]
    const cycle = Math.floor(index / baseOrders.length)
    const baseValue = parseCurrency(base.value)

    expanded.push({
      ...base,
      orderId: `${base.orderId}-${cycle + 1}`,
      date: buildSyntheticDate(cycle, index, base.date),
      items: Math.max(1, base.items + (index % 2)),
      value: formatCurrency(baseValue + cycle * 24 + (index % 3) * 11.5),
    })
  }

  return expanded
}

export function filterOrders(
  orders: PresentationOrder[],
  query: string,
  statusFilter: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  return orders.filter((order) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      order.marketplace.toLowerCase().includes(normalizedQuery) ||
      order.orderId.toLowerCase().includes(normalizedQuery) ||
      order.date.toLowerCase().includes(normalizedQuery) ||
      order.status.toLowerCase().includes(normalizedQuery)

    const matchesStatus = statusFilter === 'All statuses' || order.status === statusFilter

    return matchesQuery && matchesStatus
  })
}

export function paginateOrders<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(page, 1)
  const safePageSize = Math.max(pageSize, 1)
  const start = (safePage - 1) * safePageSize
  return items.slice(start, start + safePageSize)
}

export function exportOrdersCsv(orders: PresentationOrder[]) {
  const rows = orders.map((order) => [
    order.marketplace,
    order.orderId,
    order.date,
    order.status,
    String(order.items),
    order.value,
  ])

  return [csvHeaders, ...rows]
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}
