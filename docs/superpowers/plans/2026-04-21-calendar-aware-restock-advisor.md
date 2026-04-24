# Historical Plan - Calendar-Aware Restock Advisor

This is an English archive of the original implementation plan. The detailed pre-cleanup French task log is available in git history.

## Goal

When a merchant creates a `kind=leave` calendar event, LEIA projects stock against velocity and supplier lead times, creates one consolidated restock recommendation, and lets the merchant approve the plan from `/actions`.

## Current Implementation

- Deterministic projection logic lives in `src/lib/calendar-restock.ts`.
- Optional LLM enrichment lives in `src/lib/calendar-restock-llm.ts`.
- The primary API is `src/app/api/agent/calendar-advisor/route.ts`.
- Debug and refresh endpoints live under `src/app/api/agent/calendar-advisor/`.
- The actions inbox is served by `src/app/actions/`.
- Supplier fields are present on products and use EUR cost values.
- The workflow export lives in `workflows/calendar-advisor.json`.

## Verification

Use these commands from `src/`:

```bash
npm test
npx tsc --noEmit --pretty false
npm run build
```

## Demo Flow

1. Create a leave event in `/calendar`.
2. Let LEIA trigger the advisor or use the manual trigger endpoint.
3. Open `/actions`.
4. Review the projected stock risk.
5. Approve selected SKUs.

## Notes

- All user-facing app chrome should stay in English.
- LEIA conversation output may still switch language at runtime.
- All money is EUR.
- Historical assistant-name references have been replaced by LEIA in active code.
