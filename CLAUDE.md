# Hackathon Mirakl x Eugenia - UC1 Agent-Led Merchant Company

This repository contains the Nordika Studio demo app for an agent-led merchant workflow. The current working branch is `dev`; the AI assistant is named LEIA.

## Current Project State

| Area | Status |
| --- | --- |
| LEIA floating orb and Spotlight chat | Shipped across the app |
| Tool-using chat | Uses `/api/mascot/chat` and `gpt-5.4-mini` |
| Multilingual user interaction | LEIA detects EN/FR/IT/DE/ES and replies in the user's language |
| Internal decision traces | Templates remain in English in `decision_ledger.logical_inference` |
| Currency reference | EUR everywhere in app data, UI, and seed data |
| Calendar-aware restock advisor | Endpoint, deterministic logic, and `/actions` UI are in place |
| Whisper voice input | `/api/mascot/transcribe` uses automatic language detection |
| n8n workflow | `workflows/calendar-advisor.json` is exportable but optional locally |
| Tests | Vitest coverage includes calendar, LEIA, templates, math, guardrails, and governance |
| Production build | `npm run build` passes from `src/` |

## Language And Currency Rules

- LEIA detects the latest user message language automatically.
- Supported user languages: English, French, Italian, German, and Spanish.
- If the language is ambiguous, LEIA defaults to English.
- Internal templates and ledger traces stay in English.
- Whisper voice transcription must not hardcode a language.
- All monetary values are expressed in EUR.
- UI currency displays use the euro symbol with English formatting, for example `€1,234.56`.

## Architecture

```text
Dashboard / Stock / Actions / Calendar
  -> AppShell
    -> MascotOrb
      -> Spotlight chat drawer
        -> POST /api/mascot/chat
        -> LEIA tool loop in src/lib/leia-chat.ts
        -> Governance, math, templates, and ledger helpers in src/lib/leia

calendar_events INSERT kind=leave
  -> optional n8n webhook
  -> POST /api/agent/calendar-advisor
  -> deterministic restock projection
  -> agent_recommendations
  -> /actions inbox
```

## Key Files

| File | Role |
| --- | --- |
| `src/components/MascotOrb.tsx` | Floating LEIA orb |
| `src/lib/leia-chat.ts` | Shared OpenAI tool-calling loop |
| `src/lib/leia/conversation.ts` | LEIA system prompt, language rules, and guardrails |
| `src/lib/leia/templates.ts` | Internal English ledger templates |
| `src/lib/leia/tools-math.ts` | Deterministic math helpers |
| `src/lib/leia/ledger.ts` | Raw SQL helpers for `decision_ledger` and overrides |
| `src/app/api/leia/briefing/route.ts` | Morning briefing API |
| `src/app/api/mascot/chat/route.ts` | Chat endpoint |
| `src/app/api/mascot/transcribe/route.ts` | Whisper relay |
| `src/app/api/agent/calendar-advisor/route.ts` | Calendar-aware restock advisor |
| `src/app/actions/*` | Actions inbox and approval flow |
| `src/app/radar/page.tsx` | Losses Radar plugin view |
| `src/supabase/seed/historical_orders_n1.sql` | N-1 seasonal historical order seed |

## Commands

Run commands from `src/` unless stated otherwise.

```bash
npm run dev:3000
npm test
npx tsc --noEmit --pretty false
npm run build
npm run test:leia-math
npm run test:leia-invariant
```

Stop the dev server before `npm run build` on Windows if Prisma reports a locked query engine DLL.

## Environment Variables

```text
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
HACKATHON_USER_ID=00000000-0000-0000-0000-000000000001
OPENAI_API_KEY=...
N8N_WEBHOOK_URL=
DUST_ORCHESTRATOR_AGENT_ID=
DUST_ORCHESTRATOR_API_KEY=
```

## Notes

- CSS classes with the `iris-*` prefix are historical and remain for diff stability.
- The `/copilot` module can coexist with LEIA, but it is not linked in the primary sidebar.
- The n8n workflow is optional for local demos because LEIA can call the calendar advisor directly.
- Legacy assistant-name references have been renamed to LEIA in active code and docs.
