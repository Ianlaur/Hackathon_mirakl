# Historical Plan - Multilingual LEIA With English Internal Traces

This document summarizes the multilingual LEIA work in English. The detailed pre-cleanup working plan remains available in git history.

## Goal

LEIA should speak to the user in the user's language while keeping internal templates, math, and ledger traces in English.

## Requirements

- Detect EN, FR, IT, DE, and ES from the latest user message.
- Switch language mid-conversation when the user switches.
- Default to English when ambiguous.
- Keep internal templates in English.
- Keep all monetary values in EUR.
- Refuse prompt injection, personality hijacks, and requests for internal system details.
- Keep tool math deterministic in `src/lib/leia/tools-math.ts`.

## Current Files

- `src/lib/leia/conversation.ts`
- `src/lib/leia/templates.ts`
- `src/lib/leia/tools-math.ts`
- `src/lib/leia/ledger.ts`
- `src/lib/leia/briefing.ts`
- `src/app/api/leia/briefing/route.ts`
- `src/tests/leia-chat.test.ts`
- `src/tests/leia-briefing.test.ts`
- `src/tests/leia-templates.test.ts`
- `src/tests/leia-math.test.ts`
- `src/tests/leia-invariant.test.ts`

## Verification

```bash
cd src
npm run test:leia-math
npm run test:leia-invariant
npm test
```
