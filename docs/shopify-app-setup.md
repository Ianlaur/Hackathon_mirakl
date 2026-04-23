# Shopify App Setup

## 1) Configure environment variables

Add these keys in `src/.env`:

```env
SHOPIFY_API_KEY=""
SHOPIFY_API_SECRET=""
SHOPIFY_APP_URL="http://localhost:3000"
SHOPIFY_SCOPES="read_orders,read_products,read_inventory"
SHOPIFY_API_VERSION="2025-01"
```

`SHOPIFY_APP_URL` must match the public URL registered in your Shopify app settings.

## 2) Create app in Shopify Partners

In your Shopify custom app configuration:

- App URL: `https://<your-domain>`
- Allowed redirection URL:
  `https://<your-domain>/api/integrations/shopify/callback`

## 3) Install from the UI

Open `/marketplaces/active-connection` and use the **Shopify App** panel:

1. Enter `your-store.myshopify.com`
2. Click **Connect Shopify**
3. Approve app install in Shopify

On callback, the app stores the token and starts an initial order sync.

## 4) Webhooks

Webhooks are registered automatically during callback:

- `orders/create` -> `/api/integrations/shopify/webhooks/orders-create`
- `app/uninstalled` -> `/api/integrations/shopify/webhooks/app-uninstalled`

## 5) Manual sync endpoint

`POST /api/integrations/shopify/sync`

Example body:

```json
{ "limit": 75 }
```

## 6) Apply schema changes

Run:

```bash
cd src
npm run db:push
npm run db:generate
```
