import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Get a Prisma client with RLS context set for a specific user
 * Works with Neon Auth (JWT) and application-level auth
 */
export function getPrismaWithRLS(userId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Set the current user ID in the database session
          // This works alongside Neon Auth JWT claims
          await prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`)
          return query(args)
        },
      },
    },
  })
}

// Helper function to execute queries with retry logic for idle Neon databases
export async function prismaWithRetry<T>(
  operation: (db: PrismaClient) => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(prisma)
    } catch (error: any) {
      lastError = error
      
      const errorMessage = error.message || ''
      const isConnectionError = 
        error.code === 'P1001' || 
        error.code === 'P1017' ||
        error.code === 'P2024' ||
        errorMessage.includes('Connection') ||
        errorMessage.includes('Closed') ||
        errorMessage.includes('timeout')
      
      // Check if it's a connection error (Neon idle database)
      if (isConnectionError && attempt < maxRetries) {
        console.log(`⏳ Database connection issue, retrying... Attempt ${attempt}/${maxRetries}`)
        // Wait before retrying (progressive backoff: 2s, 4s, 6s, 8s)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
        continue
      }
      
      throw error
    }
  }

  throw lastError
}
