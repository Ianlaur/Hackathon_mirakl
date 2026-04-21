import { prisma } from './prisma'

type BasicUser = {
  id: string
  email: string | null
  name: string | null
  role: string | null
  business_type: string | null
  subscription_tier: string | null
}

let cachedUserId: string | null = null
const FALLBACK_USER_ID = '00000000-0000-0000-0000-000000000001'

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

function isDatabaseConfigError(error: unknown) {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('Environment variable not found: DATABASE_URL') ||
    error.message.includes('Invalid `prisma.')
  )
}

async function resolveUserId(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId
  }

  const envUserId = process.env.HACKATHON_USER_ID?.trim()
  if (envUserId) {
    cachedUserId = envUserId
    return envUserId
  }

  if (!hasDatabaseUrl()) {
    cachedUserId = FALLBACK_USER_ID
    return FALLBACK_USER_ID
  }

  let users: Array<{ id: string }>
  try {
    users = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM neon_auth.user
      ORDER BY "createdAt" ASC
      LIMIT 1
    `
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      cachedUserId = FALLBACK_USER_ID
      return FALLBACK_USER_ID
    }
    throw error
  }

  if (!users.length) {
    throw new Error('No user found. Set HACKATHON_USER_ID in your environment.')
  }

  cachedUserId = users[0].id
  return users[0].id
}

export async function getCurrentUserId(): Promise<string> {
  return resolveUserId()
}

export async function getCurrentUser(): Promise<BasicUser> {
  const userId = await getCurrentUserId()

  if (!hasDatabaseUrl()) {
    return {
      id: userId,
      email: 'hackathon@local',
      name: 'Hackathon User',
      role: null,
      business_type: null,
      subscription_tier: null,
    }
  }

  let users: Array<{ id: string; email: string | null; name: string | null }>
  try {
    users = await prisma.$queryRaw<Array<{ id: string; email: string | null; name: string | null }>>`
      SELECT
        id,
        email,
        name
      FROM neon_auth.user
      WHERE id = ${userId}::uuid
      LIMIT 1
    `
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return {
        id: userId,
        email: 'hackathon@local',
        name: 'Hackathon User',
        role: null,
        business_type: null,
        subscription_tier: null,
      }
    }
    throw error
  }

  if (!users.length) {
    throw new Error(`Hackathon user not found for id ${userId}`)
  }

  return {
    ...users[0],
    role: null,
    business_type: null,
    subscription_tier: null,
  }
}

export async function getCurrentUserForApi() {
  return getCurrentUser()
}

export async function getOptionalUser() {
  return getCurrentUser()
}
