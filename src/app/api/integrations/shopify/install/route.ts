import { NextRequest, NextResponse } from 'next/server'
import {
  buildShopifyInstallUrl,
  generateShopifyState,
  getShopifyConfig,
  normalizeShopDomain,
} from '@/lib/shopify'

export const dynamic = 'force-dynamic'

const SHOPIFY_STATE_COOKIE = 'shopify_oauth_state'

export async function GET(request: NextRequest) {
  try {
    const { apiKey, appUrl, scopes } = getShopifyConfig()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SHOPIFY_API_KEY is missing' },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const shopInput = url.searchParams.get('shop')
    if (!shopInput) {
      return NextResponse.json(
        { error: 'Missing shop query parameter' },
        { status: 400 }
      )
    }

    const shop = normalizeShopDomain(shopInput)
    const state = generateShopifyState()
    const baseUrl = appUrl || url.origin
    const redirectUri = `${baseUrl}/api/integrations/shopify/callback`
    const installUrl = buildShopifyInstallUrl({
      shop,
      apiKey,
      scopes,
      redirectUri,
      state,
    })

    const response = NextResponse.redirect(installUrl)
    response.cookies.set(SHOPIFY_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error creating Shopify install URL:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Shopify install URL' },
      { status: 500 }
    )
  }
}
