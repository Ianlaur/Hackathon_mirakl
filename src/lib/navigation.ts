import type { NavigationConfig } from '@/types/navigation'

export const NAVIGATION_CONFIG: NavigationConfig = {
  basicItems: [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
    {
      id: 'marketplaces',
      label: 'Marketplaces',
      icon: 'Store',
      href: '/marketplaces',
      expandable: true,
      subitems: [
        { id: 'integration-proposals', label: 'Opportunities', href: '/marketplaces/proposals' },
        { id: 'active-connection', label: 'Channels', href: '/marketplaces/active-connection' },
      ],
    },
    { id: 'calendar', label: 'Calendar', icon: 'Calendar', href: '/calendar' },
    { id: 'catalog', label: 'Catalog', icon: 'FileSpreadsheet', href: '/catalog' },
    { id: 'leia', label: 'Leia', icon: 'Bot', href: '/actions' },
    { id: 'governance', label: 'Governance', icon: 'ShieldCheck', href: '/governance' },
    { id: 'orders', label: 'Orders', icon: 'ShoppingCart', href: '/orders' },
    { id: 'stock', label: 'Stock', icon: 'Package', href: '/stock' },
    { id: 'lost', label: 'Losses Radar', icon: 'AlertTriangle', href: '/radar' },
  ],
  bottomItems: [
    { id: 'appstore', label: 'App Store', icon: 'Grid', href: '/app-store' },
    { id: 'settings', label: 'Settings', icon: 'Settings', href: '/settings' },
    { id: 'profile', type: 'profile', label: 'Jean-Charles', subtitle: 'Merchant' },
  ],
  plugins: [
    {
      id: 'plugin_actions',
      label: 'Actions',
      description: 'Operational action processing center',
      position: 1,
      items: [{ id: 'actions', label: 'Actions', icon: 'Inbox', href: '/actions' }],
    },
    {
      id: 'plugin_operations',
      label: 'Operations',
      description: 'Logistics management: calendar and transport',
      position: 2,
      items: [
        {
          id: 'transport',
          label: 'Transport',
          icon: 'Truck',
          href: '/parcels',
        },
      ],
    },
    {
      id: 'plugin_inventaire',
      label: 'Advanced inventory',
      description: 'Warehouse management',
      position: 3,
      items: [
        {
          id: 'entrepot',
          label: 'Warehouse',
          icon: 'Warehouse',
          href: '/wms',
        },
      ],
    },
  ],
}
