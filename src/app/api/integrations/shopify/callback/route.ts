import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/session'
import {
  exchangeShopifyCodeForToken,
  fetchShopifyShop,
  getShopifyConfig,
  normalizeShopDomain,
  registerShopifyWebhook,
  verifyShopifyOAuthHmac,
} from '@/lib/shopify'
import { storeShopifyConnection, syncShopifyOrdersForConnection } from '@/lib/shopify-sync'

export const dynamic = 'force-dynamic'

const SHOPIFY_STATE_COOKIE = 'shopify_oauth_state'

function buildRedirect(request: NextRequest, status: 'connected' | 'error', reason?: string) {
  const redirectUrl = new URL('/marketplaces/active-connection', request.url)
  redirectUrl.searchParams.set('shopify', status)
  if (reason) {
    redirectUrl.searchParams.set('reason', reason)
  }
  return redirectUrl
}

export async function GET(request: NextRequest) {
  const { apiKey, apiSecret, apiVersion, appUrl } = getShopifyConfig()
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing' },
      { status: 500 }
    )
  }

  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const shopInput = searchParams.get('shop')

    if (!code || !state || !shopInput) {
      return NextResponse.redirect(buildRedirect(request, 'error', 'missing_params'))
    }

    const stateCookie = request.cookies.get(SHOPIFY_STATE_COOKIE)?.value
    if (!stateCookie || stateCookie !== state) {
      return NextResponse.redirect(buildRedirect(request, 'error', 'invalid_state'))
    }

    if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
      return NextResponse.redirect(buildRedirect(request, 'error', 'invalid_hmac'))
    }

    const shop = normalizeShopDomain(shopInput)
    const tokenResponse = await exchangeShopifyCodeForToken({
      shop,
      code,
      apiKey,
      apiSecret,
    })

    const shopData = await fetchShopifyShop({
      shop,
      accessToken: tokenResponse.access_token,
      apiVersion,
    })

    const userId = await getCurrentUserId()
    const connection = await storeShopifyConnection({
      userId,
      shopDomain: shop,
      shopName: shopData.name || null,
      externalShopId: String(shopData.id),
      accessToken: tokenResponse.access_token,
      scopes:
        tokenResponse.scope
          ?.split(',')
          .map((scope) => scope.trim())
          .filter(Boolean) || [],
    })

    const baseUrl = appUrl || new URL(request.url).origin
    try {
      await registerShopifyWebhook({
        shop,
        accessToken: tokenResponse.access_token,
        apiVersion,
        topic: 'orders/create',
        address: `${baseUrl}/api/integrations/shopify/webhooks/orders-create`,
      })
      await registerShopifyWebhook({
        shop,
        accessToken: tokenResponse.access_token,
        apiVersion,
        topic: 'app/uninstalled',
        address: `${baseUrl}/api/integrations/shopify/webhooks/app-uninstalled`,
      })
    } catch (webhookError) {
      console.error('Shopify webhook registration failed:', webhookError)
    }

    try {
      await syncShopifyOrdersForConnection({
        connectionId: connection.id,
        limit: 50,
      })
    } catch (syncError) {
      console.error('Shopify initial sync failed:', syncError)
    }

    const response = NextResponse.redirect(buildRedirect(request, 'connected'))
    response.cookies.delete(SHOPIFY_STATE_COOKIE)
    return response
  } catch (error) {
    console.error('Error in Shopify callback:', error)
    const response = NextResponse.redirect(buildRedirect(request, 'error', 'callback_failed'))
    response.cookies.delete(SHOPIFY_STATE_COOKIE)
    return response
  }
}
