const fs = require('fs')

function readEnvFile(path) {
  const env = {}
  const content = fs.readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    const key = match[1]
    const rawValue = match[2].trim()
    const value = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue
    env[key] = value
  }
  return env
}

function validateResponse(payload) {
  const required = ['alertSummary', 'analysis', 'proposedSolution']
  const missing = required.filter((key) => typeof payload[key] !== 'string' || payload[key].trim() === '')
  return { ok: missing.length === 0, missing }
}

async function main() {
  const envFromFile = fs.existsSync('.env') ? readEnvFile('.env') : {}
  const env = { ...envFromFile, ...process.env }

  const webhookUrl = env.DUST_AGENT_WEBHOOK_URL
  const apiKey = env.DUST_AGENT_API_KEY

  if (!webhookUrl) {
    throw new Error('Missing DUST_AGENT_WEBHOOK_URL in .env')
  }

  const payload = {
    event: 'low_stock_trigger',
    userId: env.HACKATHON_USER_ID || '00000000-0000-0000-0000-000000000001',
    productId: '11111111-1111-1111-1111-111111111111',
    productName: 'Integration Test SKU',
    quantity: 2,
    threshold: 10,
    supplier: 'Test Supplier',
    generatedAt: new Date().toISOString(),
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  const responseText = await response.text()
  let responseJson = {}
  try {
    responseJson = JSON.parse(responseText)
  } catch {
    throw new Error(`Dust response is not valid JSON. HTTP ${response.status}. Body: ${responseText}`)
  }

  if (!response.ok) {
    throw new Error(`Dust webhook failed with HTTP ${response.status}: ${responseText}`)
  }

  const result = validateResponse(responseJson)
  if (!result.ok) {
    throw new Error(
      `Dust response missing required fields: ${result.missing.join(', ')}. Full body: ${JSON.stringify(responseJson)}`
    )
  }

  console.log('Dust test passed.')
  console.log(JSON.stringify(responseJson, null, 2))
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
