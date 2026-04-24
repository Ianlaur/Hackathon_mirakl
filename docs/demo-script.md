# Loom Demo Script - Calendar-Aware Restock Advisor

Target duration: 90 seconds inside the full Loom.

## Preparation

Run from `src/`:

```bash
npx ts-node --compiler-options "{\"module\":\"CommonJS\",\"target\":\"es2017\"}" scripts/seed-demo-scenario.ts
```

This resets selected stock levels to a critical state, creates a leave event, and prints the event UUID.

## Sequence

| Time | Screen | Action | Voiceover |
| --- | --- | --- | --- |
| 00:00 | `/dashboard` | Open LEIA chat | "LEIA watches operations and knows the merchant calendar." |
| 00:10 | `/calendar` | Create a leave event | "The merchant adds time away in the calendar." |
| 00:20 | Sidebar | Open Actions | "LEIA detects the absence and prepares one consolidated plan." |
| 00:25 | `/actions` | Select the calendar restock recommendation | "One plan, not five disconnected alerts." |
| 00:35 | `/actions` | Point at projected negative stock | "These SKUs are expected to stock out during the absence." |
| 00:55 | `/actions` | Deselect one SKU | "The merchant can exclude lines they want to handle separately." |
| 01:05 | `/actions` | Approve the selection | "One click approves the plan." |
| 01:15 | Confirmation | Status changes to approved | "The business keeps moving while the founder is away." |

## Plan B

If n8n is not connected, trigger the advisor manually:

```bash
curl -X POST http://localhost:3000/api/agent/calendar-advisor/trigger \
  -H "Content-Type: application/json" \
  -d "{\"event_id\":\"EVENT_UUID\"}"
```

Then refresh `/actions`.
