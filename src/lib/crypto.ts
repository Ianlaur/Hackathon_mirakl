import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const DEFAULT_SECRET = 'merchant-ops-copilot-dev-secret'

function getKey() {
  return createHash('sha256')
    .update(process.env.COPILOT_ENCRYPTION_SECRET || DEFAULT_SECRET)
    .digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptSecret(value: string) {
  const [ivEncoded, authTagEncoded, encryptedEncoded] = value.split(':')
  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error('Invalid encrypted secret format')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivEncoded, 'base64')
  )

  decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function maskSecret(value: string) {
  const trimmed = value.trim()
  if (trimmed.length <= 8) {
    return 'Configured'
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}
