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
      subitems: [{ id: 'integration-proposals', label: 'Integration Proposals', href: '/marketplaces/proposals' }],
    },
    { id: 'calendar', label: 'Calendar', icon: 'Calendar', href: '/calendar' },
    { id: 'copilot', label: 'Copilot', icon: 'Bot', href: '/copilot' },
    { id: 'orders', label: 'Orders', icon: 'ShoppingCart', href: '/orders' },
    { id: 'stock', label: 'Stock', icon: 'Package', href: '/stock' },
    { id: 'lost', label: 'Lost', icon: 'AlertTriangle', href: '/lost' },
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
          id: 'operations',
          label: 'Opérations',
          icon: 'GitBranch',
          href: '/operations',
          expandable: true,
          subitems: [
            { id: 'calendrier', label: 'Calendrier', href: '/operations/calendrier' },
            { id: 'transport', label: 'Transport', href: '/operations/transport' },
          ],
        },
      ],
    },
    {
      id: 'plugin_inventaire',
      label: 'Inventaire avancé',
      description: 'Entrepôts et suivi des pertes',
      position: 3,
      items: [
        {
          id: 'inventaire',
          label: 'Inventaire',
          icon: 'Boxes',
          href: '/inventaire',
          expandable: true,
          subitems: [
            { id: 'entrepot', label: 'Entrepôt', href: '/inventaire/entrepot' },
            { id: 'pertes', label: 'Pertes', href: '/inventaire/pertes' },
          ],
        },
      ],
    },
  ],
}
