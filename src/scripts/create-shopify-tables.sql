-- Shopify integration tables. Present in prisma/schema.prisma but never applied to DB.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.shopify_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_domain text NOT NULL UNIQUE,
  shop_name text,
  external_shop_id text,
  encrypted_access_token text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active',
  installed_at timestamptz,
  uninstalled_at timestamptz,
  last_synced_at timestamptz,
  last_webhook_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shopify_connections_user_status
  ON public.shopify_connections (user_id, status);
CREATE INDEX IF NOT EXISTS idx_shopify_connections_user_created
  ON public.shopify_connections (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.shopify_connections(id) ON DELETE CASCADE,
  shopify_order_id text NOT NULL,
  order_name text,
  email text,
  currency text,
  financial_status text,
  fulfillment_status text,
  order_status_url text,
  line_items_count integer NOT NULL DEFAULT 0,
  total_price numeric(12, 2),
  subtotal_price numeric(12, 2),
  total_tax numeric(12, 2),
  total_discounts numeric(12, 2),
  processed_at timestamptz,
  order_created_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, shopify_order_id)
);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_user_created
  ON public.shopify_orders (user_id, order_created_at);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_connection_created
  ON public.shopify_orders (connection_id, order_created_at);
