const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} is missing ${expected}`)
  }
}

function assertNotIncludes(content, unexpected, label) {
  if (content.includes(unexpected)) {
    throw new Error(`${label} still contains ${unexpected}`)
  }
}

const globals = read('app/globals.css')
const dashboard = read('app/dashboard/page.tsx')
const appShell = read('components/AppShell.tsx')
const sidebar = read('components/Sidebar.tsx')
const actions = read('app/actions/ActionsPageClient.tsx')
const decisionFeed = read('components/mira/DecisionFeed.tsx')
const appStore = read('app/app-store/page.tsx')
const copilot = read('app/copilot/page.tsx')
const settings = read('app/settings/page.tsx')
const routedPages = [
  'app/actions/ActionsPageClient.tsx',
  'app/activity/page.tsx',
  'app/app-store/page.tsx',
  'app/calendar/CalendarPageClient.tsx',
  'app/dashboard/page.tsx',
  'app/losses/LossesPageClient.tsx',
  'app/parcels/ParcelsPageClient.tsx',
  'app/planning/PlanningPageClient.tsx',
  'app/settings/page.tsx',
  'app/stock/StockPageClient.tsx',
  'app/wms/WMSPageClient.tsx',
]
const activity = fs.existsSync(path.join(root, 'app/activity/page.tsx'))
  ? read('app/activity/page.tsx')
  : ''

for (const token of ['--mira-bg: #F2F8FF', '--mira-ink: #03182F', '--mira-blue: #2764FF', '--mira-pink: #F22E75', '--alert: #F22E75']) {
  assertIncludes(globals, token, 'globals.css')
}

for (const className of ['.mira-card', '.mira-map-card', '.mira-label', '.mira-live-dot']) {
  assertIncludes(globals, className, 'globals.css')
}

assertIncludes(globals, '.mira-display', 'globals.css')
assertIncludes(globals, '.mira-button', 'globals.css')
assertIncludes(globals, '.mira-interactive', 'globals.css')
assertIncludes(globals, '.mira-focus-ring', 'globals.css')
assertIncludes(globals, 'transition: all 150ms ease-out', 'interaction timing')
assertIncludes(globals, 'focus-visible', 'keyboard focus')
assertIncludes(globals, '@keyframes badge-pulse', 'globals.css')
assertIncludes(globals, '@keyframes feed-in', 'globals.css')
assertIncludes(globals, '@keyframes mira-breathe', 'globals.css')
assertIncludes(globals, '.feed-in', 'globals.css')
assertIncludes(globals, '.map-pulse', 'globals.css')
assertIncludes(globals, '.mira-breathing-orb', 'globals.css')
assertIncludes(globals, '4s ease-in-out infinite', 'globals.css')
assertIncludes(globals, '2s ease-in-out infinite', 'globals.css')
assertNotIncludes(globals, 'border: 1px solid var(--mira-border);', 'standard cards')
assertIncludes(globals, '.mira-shell .rounded-2xl', 'global premium normalization')
assertIncludes(globals, '.mira-shell .rounded-3xl', 'global premium normalization')
assertIncludes(globals, '.mira-shell .text-gray-900', 'global premium normalization')
assertIncludes(globals, '.mira-shell .bg-emerald-50', 'global premium normalization')
assertIncludes(globals, '.mira-shell .bg-purple-50', 'global premium normalization')

for (const flag of ['🇬🇧', '🇫🇷', '🇩🇪', '🇪🇸', '🇮🇹', '🇳🇱']) {
  assertNotIncludes(dashboard, flag, 'dashboard flag emojis')
  assertNotIncludes(activity, flag, 'activity flag emojis')
  assertNotIncludes(decisionFeed, flag, 'decision feed flag emojis')
  for (const pagePath of routedPages) {
    assertNotIncludes(read(pagePath), flag, `${pagePath} flag emojis`)
  }
}

assertIncludes(dashboard, 'Operations Room', 'dashboard')
assertIncludes(dashboard, 'Atlas', 'dashboard')
assertIncludes(dashboard, 'MIRA AI Copilot', 'dashboard')
assertIncludes(dashboard, 'PersistentMiraCopilot', 'dashboard')
assertIncludes(dashboard, 'mira-copilot-panel', 'dashboard')
assertIncludes(dashboard, 'mira-copilot-feed', 'dashboard')
assertIncludes(dashboard, 'mira-copilot-input', 'dashboard')
assertIncludes(dashboard, 'Sparkles', 'dashboard')
assertIncludes(dashboard, '⌘K', 'copilot keyboard cue')
assertIncludes(dashboard, "event.key.toLowerCase() === 'k'", 'copilot keyboard shortcut')
assertIncludes(dashboard, 'focus-visible:ring-2 focus-visible:ring-[#2764FF]/50', 'dashboard focus ring')
assertIncludes(dashboard, 'transition-all duration-150 ease-out', 'dashboard interaction timing')
assertIncludes(dashboard, 'min-h-[280px]', 'copilot reserved decision space')
assertIncludes(dashboard, 'Approve', 'dashboard')
assertIncludes(dashboard, 'Details', 'dashboard')
assertIncludes(dashboard, 'System Status', 'dashboard')
assertIncludes(dashboard, 'Nominal', 'dashboard')
assertIncludes(dashboard, 'MapPin', 'dashboard map badges')
assertIncludes(dashboard, 'MapDashboard', 'dashboard')
assertNotIncludes(dashboard, 'ActionFirstRightRail', 'dashboard')
assertNotIncludes(dashboard, 'MiraDecisionFeed', 'dashboard')
assertIncludes(dashboard, 'PremiumCard', 'dashboard')
assertIncludes(dashboard, 'PageHeader', 'dashboard')
assertIncludes(dashboard, 'mira-card', 'dashboard')
assertIncludes(dashboard, 'mira-map-card', 'dashboard')
assertIncludes(dashboard, 'mira-display', 'dashboard')
assertNotIncludes(dashboard, 'Control Tower', 'dashboard')
assertNotIncludes(dashboard, 'Live Pulse', 'dashboard')
assertNotIncludes(dashboard, 'OrdersTable', 'dashboard')
assertNotIncludes(dashboard, 'hover:scale', 'cheap hover transforms')
assertNotIncludes(dashboard, 'hover:-translate', 'cheap hover transforms')
assertNotIncludes(dashboard, 'text-gray-', 'dashboard default colors')
assertNotIncludes(dashboard, 'text-blue-', 'dashboard default colors')
assertNotIncludes(dashboard, 'bg-gray-', 'dashboard default colors')
assertNotIncludes(dashboard, 'bg-blue-', 'dashboard default colors')
assertNotIncludes(dashboard, 'Recent Orders', 'dashboard main view')
assertNotIncludes(dashboard, 'orders processed smoothly today', 'sentence-style system copy')
assertNotIncludes(dashboard, 'Exceptions first, operational context second', 'sentence-style header copy')
assertNotIncludes(dashboard, 'single source of truth', 'sentence-style map copy')
assertNotIncludes(dashboard, 'Ask Mira to propose a governed restock decision', 'sentence-style empty copy')
assertNotIncludes(dashboard, '<section className="grid gap-3 md:grid-cols-3">', 'top KPI strip')
assertIncludes(dashboard, 'lucide-react', 'dashboard')

assertIncludes(sidebar, '#03182F', 'sidebar')
assertIncludes(sidebar, 'MIRA', 'sidebar')
assertIncludes(sidebar, 'Nordika Studio', 'sidebar')
assertIncludes(sidebar, 'lucide-react', 'sidebar')
assertIncludes(sidebar, '/activity', 'sidebar activity route')

assertIncludes(appShell, 'usePathname', 'app shell route awareness')
assertIncludes(appShell, 'MascotOrb', 'app shell Iris mascot')
assertIncludes(appShell, "pathname === '/' || pathname === '/dashboard'", 'app shell atlas route')
assertIncludes(appShell, '!isAtlasRoute ? <MascotOrb /> : null', 'app shell Iris secondary routes')
assertNotIncludes(appShell, 'function MiraBreathingOrb', 'app shell small M orb')

assertIncludes(actions, 'Decision Room', 'actions page')
assertIncludes(actions, 'mira-card', 'actions page')
assertIncludes(actions, 'border-[#2764FF]', 'actions page')
assertIncludes(actions, 'lucide-react', 'actions page')

assertIncludes(decisionFeed, 'Needs Your Decision', 'decision feed')
assertIncludes(decisionFeed, 'lucide-react', 'decision feed')
assertIncludes(decisionFeed, 'feed-in', 'decision feed')
assertIncludes(decisionFeed, 'badge-pulse', 'decision feed')
assertIncludes(decisionFeed, 'RiskSparkline', 'decision feed')
assertIncludes(decisionFeed, 'DecisionMetricBar', 'decision feed')
assertIncludes(decisionFeed, 'TrendingDown', 'decision feed')
assertNotIncludes(decisionFeed, 'line-clamp-3', 'decision feed explanatory copy')
assertNotIncludes(decisionFeed, 'No governed decisions yet. Ask Mira', 'decision feed empty copy')

assertIncludes(activity, 'Activity', 'activity page')
assertIncludes(activity, 'Recently Handled', 'activity page')
assertIncludes(activity, 'Upcoming Events', 'activity page')
assertIncludes(activity, 'HorizontalTimeline', 'activity page')
assertIncludes(activity, 'aria-label="Six-month timeline track"', 'activity timeline')
assertNotIncludes(activity, 'Raw logs, handled work, and future events live here', 'activity sentence copy')

assertIncludes(appStore, 'Mira Plugin Store', 'app store')
assertIncludes(appStore, 'mira-card', 'app store')
for (const slop of ['AI-powered', 'The most powerful', 'mock marketplace UI', 'Control Tower & Stripe Routing', 'Product rule']) {
  assertNotIncludes(appStore, slop, 'app store copy')
}

assertIncludes(copilot, "redirect('/actions')", 'legacy copilot route')
assertNotIncludes(copilot, 'Copilot Mira', 'legacy copilot route')

for (const stale of ['Copilote IA', 'copilote marchand', 'Enregistrer le copilote', 'Paramètres copilote']) {
  assertNotIncludes(settings, stale, 'settings Mira wording')
}

console.log('Mira design language checks passed')
