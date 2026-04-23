import type { NavigationConfig } from '@/types/navigation'

export const NAVIGATION_CONFIG: NavigationConfig = {
  basicItems: [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
    {
      id: 'marketplaces',
      label: 'Marketplaces',
      icon: 'Store',
      href: '/marketplaces/proposals',
      expandable: true,
      subitems: [
        { id: 'integration-proposals', label: 'Opportunities', href: '/marketplaces/proposals' },
        { id: 'active-connection', label: 'Channels', href: '/marketplaces/active-connection' },
      ],
    },
    { id: 'calendar', label: 'Calendar', icon: 'Calendar', href: '/calendar' },
    { id: 'leia', label: 'Leia', icon: 'Bot', href: '/actions' },
    { id: 'orders', label: 'Orders', icon: 'ShoppingCart', href: '/orders' },
    { id: 'stock', label: 'Stock', icon: 'Package', href: '/stock' },
    { id: 'lost', label: 'Losses', icon: 'AlertTriangle', href: '/losses' },
    { id: 'activity', label: 'Activity', icon: 'History', href: '/activity' },
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
      description: 'Centre de traitement des actions opérationnelles',
      position: 1,
      items: [{ id: 'actions', label: 'Actions', icon: 'Inbox', href: '/actions' }],
    },
    {
      id: 'plugin_operations',
      label: 'Opérations',
      description: 'Gestion logistique : calendrier et transport',
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
      label: 'Inventaire avancé',
      description: 'Gestion des entrepôts',
      position: 3,
      items: [
        {
          id: 'entrepot',
          label: 'Entrepôt',
          icon: 'Warehouse',
          href: '/wms',
        },
      ],
    },
  ],
}
