# Dust Agent Integration (Low Stock Trigger)

This project dispatches low-stock events to a Dust-compatible webhook from:

- `src/lib/lowStockAutomation.ts`

When stock goes below threshold (`max(min_quantity, 10)`), DB trigger queues an alert in `stock_low_alerts`.
On dashboard load, pending alerts are sent to your Dust endpoint.

## 1) Configure env

In `src/.env` set:

```env
DUST_AGENT_WEBHOOK_URL="https://<your-endpoint>"
DUST_AGENT_API_KEY="<optional-bearer-token>"
```

If `DUST_AGENT_WEBHOOK_URL` is missing, the app uses fallback local analysis text.

## 2) Use the YAML contract

Use this file as your Dust agent contract/spec:

- `src/config/dust-low-stock-agent.yaml`

It defines:
- input payload fields sent by the app
- required response fields expected by the app
- example request/response

## 3) Expected request payload

The app sends:

```json
{
  "event": "low_stock_trigger",
  "userId": "uuid",
  "productId": "uuid",
  "productName": "string",
  "quantity": 2,
  "threshold": 10,
  "supplier": "string|null",
  "generatedAt": "ISO datetime"
}
```

## 4) Required response payload

Your Dust endpoint should return JSON with:

```json
{
  "alertSummary": "string",
  "analysis": "string",
  "proposedSolution": "string",
  "confidence": "low|medium|high|critical"
}
```

The app also accepts aliases:
- `reasoning` or `response` instead of `analysis`
- `solution` or `recommendation` instead of `proposedSolution`

## 5) Test the Dust endpoint

Run:

```bash
cd src
npm run dust:test:low-stock
```

This sends a synthetic low-stock event and validates required response fields.

## 6) End-to-end runtime check

1. Ensure trigger is installed:
   - `npm run db:prepare:low-stock`
2. Reduce a product stock below threshold.
3. Open `/dashboard`.
4. Confirm:
   - a `stock_low_alerts` row is processed
   - dashboard shows `Agent analysis` and `Proposed solution`
