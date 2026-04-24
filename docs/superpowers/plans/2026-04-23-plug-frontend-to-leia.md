# Historical Plan - Plug Frontend To LEIA

This archive records the intent of the frontend integration pass after the assistant was renamed to LEIA.

## Goal

Connect Dashboard, Actions, Orders, Radar, and plugin surfaces to live backend data so demo pages behave like one coherent merchant operations app.

## Current Architecture

- Dashboard and Orders use client-side fetches for recent orders and decision data.
- `/api/actions` adapts `decision_ledger` rows into the recommendation UI shape.
- LEIA backend code lives under `src/lib/leia`.
- LEIA API routes live under `src/app/api/leia`.
- Simulated components must show `SIMULATED`.

## Implementation Notes

- User-facing name: LEIA.
- Internal templates: English.
- Money: EUR.
- Deprecated assistant paths and package scripts have been renamed.
- The app keeps legacy `iris-*` CSS class names for diff stability.

## Verification

```bash
cd src
npm test
npx tsc --noEmit --pretty false
npm run build
```
