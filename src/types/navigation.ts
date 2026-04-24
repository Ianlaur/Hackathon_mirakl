export interface SubNavItem {
  id: string
  label: string
  href: string
}

export interface NavItem {
  id: string
  label: string
  icon?: string
  href?: string
  expandable?: boolean
  subitems?: SubNavItem[]
  type?: 'link' | 'profile'
  subtitle?: string
}

export interface NavPlugin {
  id: string
  label: string
  description: string
  items: NavItem[]
  position: number
  surfaceLabel?: string
}

export interface NavigationConfig {
  basicItems: NavItem[]
  bottomItems: NavItem[]
  plugins: NavPlugin[]
}
