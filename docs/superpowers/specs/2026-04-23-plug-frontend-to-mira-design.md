# Historical Spec - Plug Frontend To LEIA Design

This spec was originally written before the assistant rename. Active code now uses LEIA for user-facing and internal assistant naming.

## Active Naming

- Assistant name: LEIA
- Core library path: `src/lib/leia`
- API path: `src/app/api/leia`
- Internal templates: English
- Currency: EUR

## Data Wiring Intent

The design intent remains:

- Dashboard surfaces recent orders, decision status, and operational signals from live endpoints.
- Orders surfaces recent order data and ledger context.
- Actions adapts `decision_ledger` rows into the existing recommendation UI.
- Plugin pages read from database-backed APIs and label simulated data as `SIMULATED`.

## Verification

```bash
cd src
npm test
npx tsc --noEmit --pretty false
npm run build
```
