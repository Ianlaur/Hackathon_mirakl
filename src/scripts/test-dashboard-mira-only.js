const fs = require('fs')
const path = require('path')
const assert = require('assert')

const dashboardPath = path.resolve(__dirname, '../app/dashboard/page.tsx')
const source = fs.readFileSync(dashboardPath, 'utf8')

assert(!source.includes('chatOpen'), 'dashboard should not keep the legacy chatOpen copilot widget state')
assert(!source.includes('Toggle AI Copilot'), 'dashboard should not render the legacy AI Copilot toggle')
assert(source.includes('PersistentMiraCopilot'), 'dashboard should render the persistent MIRA copilot rail')
assert(source.includes('MIRA AI Copilot'), 'dashboard should label the new MIRA AI copilot rail')

console.log('Dashboard Mira-only check OK')
