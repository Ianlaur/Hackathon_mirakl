# Enable The n8n Calendar Advisor Workflow

The workflow in `workflows/calendar-advisor.json` can be imported into n8n and connected to the Next.js app. This is optional for local demos because LEIA can also trigger the advisor directly.

## Prerequisites

- n8n Cloud or a self-hosted n8n instance
- A public URL for the app, either through ngrok or Vercel
- `APP_BASE_URL` pointing to that public URL

## Step 1 - Expose The App

For local demos:

```bash
cd src
npm run dev:3000
ngrok http 3000
```

Copy the generated `https://...ngrok-free.app` URL. That value is `APP_BASE_URL`.

For production demos, deploy to Vercel and use the production URL.

## Step 2 - Import The Workflow

1. Open n8n.
2. Import `workflows/calendar-advisor.json`.
3. Confirm the workflow contains the Webhook, IF, POST Advisor, Cron, and GET Refresh nodes.

## Step 3 - Configure n8n

Set `APP_BASE_URL` in n8n to the public app URL. The POST Advisor node calls:

```text
{{ $env.APP_BASE_URL }}/api/agent/calendar-advisor
```

The daily refresh node calls:

```text
{{ $env.APP_BASE_URL }}/api/agent/calendar-advisor/refresh
```

## Step 4 - Connect The App

Copy the production webhook URL from n8n and set it in `src/.env`:

```text
N8N_WEBHOOK_URL=https://.../webhook/calendar-leave-created
```

Restart the dev server after changing environment variables.

## Step 5 - Verify

1. Open `/calendar`.
2. Create a leave event.
3. Confirm n8n records a new execution.
4. Confirm `/actions` shows the calendar restock recommendation.

## Troubleshooting

- If the webhook is not called, verify `N8N_WEBHOOK_URL` and restart the app.
- If n8n receives the webhook but the IF node is false, inspect the event payload shape.
- If POST Advisor returns 500, make sure `APP_BASE_URL` is public and not `localhost`.
- If an ngrok URL changes, update `APP_BASE_URL` in n8n.
