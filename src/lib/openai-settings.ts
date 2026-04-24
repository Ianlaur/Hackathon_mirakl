import { decryptSecret } from '@/lib/crypto'
import { prismaWithRetry } from '@/lib/prisma'

export async function getOpenAISettingsForUser(userId: string) {
  const settings = await prismaWithRetry((db) =>
    db.merchantAiSettings.findUnique({
      where: { user_id: userId },
      select: {
        encrypted_api_key: true,
        preferred_model: true,
      },
    })
  ).catch(() => null)

  const merchantApiKey = settings?.encrypted_api_key
    ? decryptSecret(settings.encrypted_api_key)
    : null
  const envApiKey = process.env.OPENAI_API_KEY?.trim() || null
  const apiKey = merchantApiKey || envApiKey

  const preferredModel = settings?.preferred_model?.trim() || null
  const model =
    preferredModel && preferredModel.startsWith('gpt-5')
      ? preferredModel
      : process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-5.4-mini'

  return {
    apiKey,
    model,
  }
}
