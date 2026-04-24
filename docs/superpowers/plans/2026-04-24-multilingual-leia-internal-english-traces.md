# Multilingual LEIA With English Internal Traces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LEIA respond in the user's language while keeping internal governance traces and decision templates in English, backed by tests and real database verification.

**Architecture:** Extend the current LEIA runtime into a multilingual conversation layer, add a real `src/lib/mira` governance core for templates, math, briefing, and ledger access, then bridge the existing chat endpoints to that core without changing public API endpoints or UI structure. Use the existing Supabase tables (`decision_ledger`, `decision_templates`, `override_records`, `autonomy_config`, `founder_state`, `commercial_calendar`, `operational_objects`) as the source of truth.

**Tech Stack:** Next.js route handlers, Prisma Client with PostgreSQL raw SQL where needed, OpenAI Chat Completions + Whisper, Vitest, TypeScript.

---

### Task 1: Add Governance Models To Prisma Schema

**Files:**
- Modify: `src/prisma/schema.prisma`
- Verify: `src/node_modules/.prisma/client` via `npx prisma generate`

- [ ] **Step 1: Add the missing governance models to the Prisma schema**

Add models for:
- `DecisionTemplate`
- `DecisionLedger`
- `OverrideRecord`
- `FounderState`
- `AutonomyConfig`
- `OperationalObject`
- `CommercialCalendar`

Match the live database column names already present in `public`.

- [ ] **Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: exit code `0`

- [ ] **Step 3: Run typecheck to catch schema/client drift early**

Run: `npx tsc --noEmit`
Expected: no Prisma type errors

### Task 2: Create English Template Registry

**Files:**
- Create: `src/lib/mira/templates.ts`
- Test: `src/tests/mira-templates.test.ts`

- [ ] **Step 1: Write failing template tests**

Cover:
- all 14 required template IDs exist
- `render()` returns deterministic English strings
- unknown template IDs throw

- [ ] **Step 2: Run the new template tests and verify failure**

Run: `npm test -- mira-templates.test.ts`
Expected: fail because `src/lib/mira/templates.ts` does not exist yet

- [ ] **Step 3: Implement `src/lib/mira/templates.ts`**

Export:
- `TEMPLATE_REGISTRY`
- `MIRA_TEMPLATE_IDS`
- `renderTemplate(templateId, input)`

Write all 14 templates in English:
- `oversell_risk_v1`
- `restock_proposal_v1`
- `vacation_queue_v1`
- `returns_pattern_v1`
- `reconciliation_variance_v1`
- `fuse_tripped_v1`
- `calendar_posture_v1`
- `listing_pause_v1`
- `listing_resume_v1`
- `buffer_adjustment_v1`
- `reputation_shield_v1`
- `seasonal_prediction_v1`
- `carrier_audit_v1`
- `supplier_scorecard_v1`

- [ ] **Step 4: Re-run template tests**

Run: `npm test -- mira-templates.test.ts`
Expected: pass

### Task 3: Add `tools-math` Core And Unit Tests

**Files:**
- Create: `src/lib/mira/tools-math.ts`
- Create: `src/tests/mira-math.test.ts`
- Modify: `src/package.json`

- [ ] **Step 1: Write failing math tests**

Cover:
- `calculateVelocity`
- `calculateStockoutDays`
- `calculateReorderQty`
- `calculateGrowthFactor`
- `calculateReturnRate`
- `calculateMargin`

- [ ] **Step 2: Run the math tests and verify failure**

Run: `npm test -- mira-math.test.ts`
Expected: fail because `tools-math.ts` does not exist yet

- [ ] **Step 3: Implement `src/lib/mira/tools-math.ts`**

Keep functions deterministic, pure, and numeric-only.

- [ ] **Step 4: Add a package script**

In `src/package.json`, add:
- `"test:mira-math": "vitest run tests/mira-math.test.ts"`

- [ ] **Step 5: Re-run the math tests**

Run: `npm run test:mira-math`
Expected: pass

### Task 4: Create Ledger Access Layer And Invariant Test

**Files:**
- Create: `src/lib/mira/ledger.ts`
- Create: `src/tests/mira-invariant.test.ts`
- Modify: `src/package.json`

- [ ] **Step 1: Write failing invariant tests**

Cover:
- registry keys match `public.decision_templates`
- every `decision_ledger.template_id` is registered
- `renderTemplate()` rejects unknown IDs
- repeated render with same input produces identical output

- [ ] **Step 2: Run invariant tests and verify failure**

Run: `npm test -- mira-invariant.test.ts`
Expected: fail because ledger helper does not exist yet

- [ ] **Step 3: Implement `src/lib/mira/ledger.ts`**

Add helpers to:
- list decision templates from DB
- list recent ledger rows
- create/update decision rows
- create override records
- optionally backfill `logical_inference` from templates

- [ ] **Step 4: Add package script**

In `src/package.json`, add:
- `"test:mira-invariant": "vitest run tests/mira-invariant.test.ts"`

- [ ] **Step 5: Re-run invariant tests**

Run: `npm run test:mira-invariant`
Expected: pass against the real Supabase tables

### Task 5: Replace The Current Language Layer With True Multilingual Detection

**Files:**
- Modify: `src/lib/leia-chat.ts`
- Create: `src/lib/mira/conversation.ts`
- Test: `src/tests/leia-chat.test.ts`

- [ ] **Step 1: Expand the tests first**

Add cases for:
- French
- English
- Italian
- German
- Spanish
- ambiguous fallback to English
- mid-conversation language switch
- refusal language matching attack language

- [ ] **Step 2: Run the language tests and verify failure**

Run: `npm test -- leia-chat.test.ts`
Expected: fail because only `fr/en` are currently supported

- [ ] **Step 3: Implement multilingual conversation logic**

Move language rules into `src/lib/mira/conversation.ts`:
- `detectConversationLanguage`
- `resolveConversationLanguage`
- `buildLeiaSystemPrompt`

Rules:
- respond in user language
- support `en/fr/it/de/es`
- switch mid-conversation
- default ambiguous to English
- internal names/channels/template IDs stay untranslated

- [ ] **Step 4: Rewire `src/lib/leia-chat.ts` to use the new conversation module**

Keep route handler payloads unchanged.

- [ ] **Step 5: Re-run language tests**

Run: `npm test -- leia-chat.test.ts`
Expected: pass

### Task 6: Remove Forced Whisper Language And Verify Response Language Flow

**Files:**
- Modify: `src/app/api/mascot/transcribe/route.ts`
- Add test: `src/tests/mascot-transcribe.test.ts`

- [ ] **Step 1: Write a failing test around Whisper request payload**

Assert that the upstream request no longer appends `language` unless explicitly needed for another path.

- [ ] **Step 2: Run the transcribe test and verify failure**

Run: `npm test -- mascot-transcribe.test.ts`
Expected: fail because the route currently forwards `language`

- [ ] **Step 3: Implement the route change**

Use:
- `file`
- `model: "whisper-1"`
- no hardcoded language parameter

- [ ] **Step 4: Re-run the transcribe test**

Run: `npm test -- mascot-transcribe.test.ts`
Expected: pass

### Task 7: Add Morning Briefing Language Logic

**Files:**
- Create: `src/lib/mira/briefing.ts`
- Create: `src/app/api/mira/briefing/route.ts`
- Create: `src/tests/mira-briefing.test.ts`

- [ ] **Step 1: Write failing briefing tests**

Cover:
- reads last user message language from conversation history
- defaults to English if no history exists
- briefing output uses that language

- [ ] **Step 2: Run briefing tests and verify failure**

Run: `npm test -- mira-briefing.test.ts`
Expected: fail because briefing module/route do not exist

- [ ] **Step 3: Implement `buildBriefing`**

Make it query:
- velocity-like signals
- stock risks
- queued decisions
- calendar events
- returns patterns where available

- [ ] **Step 4: Implement the briefing route**

Keep output JSON-only; no UI changes in this task.

- [ ] **Step 5: Re-run briefing tests**

Run: `npm test -- mira-briefing.test.ts`
Expected: pass

### Task 8: Bridge Existing Action Flow To English Internal Traces

**Files:**
- Modify: `src/lib/mascot-tools.ts`
- Modify: `src/app/api/copilot/chat/route.ts`
- Modify: `src/app/api/mascot/chat/route.ts`
- Possibly modify: `src/lib/dashboard.ts`

- [ ] **Step 1: Add helper coverage for English trace creation**

Test that action-producing paths create or update ledger traces in English even when the user language is French, Italian, German, or Spanish.

- [ ] **Step 2: Run those tests and verify failure**

Run: `npm test -- dashboard-marketplaces.test.ts leia-chat.test.ts`
Expected: fail on missing English trace behavior

- [ ] **Step 3: Implement English internal trace writing**

For each action-producing path, generate `logical_inference` via `renderTemplate()` and write/update `decision_ledger` in English.

- [ ] **Step 4: Add display translation via the conversation layer**

When LEIA reads a decision trace back to the user, return the response in the user's language while leaving DB trace untouched.

- [ ] **Step 5: Re-run targeted tests**

Run: `npm test -- dashboard-marketplaces.test.ts leia-chat.test.ts`
Expected: pass

### Task 9: Backfill Existing Ledger Traces To English

**Files:**
- Create: `src/scripts/backfill-decision-ledger-english.ts`
- Optional docs note: `CLAUDE.md`

- [ ] **Step 1: Implement a safe backfill script**

For rows with known `template_id`, reconstruct English `logical_inference` from `raw_payload` where possible.

- [ ] **Step 2: Run the script against the current Supabase data**

Run: `npx ts-node --compiler-options "{\"module\":\"CommonJS\",\"target\":\"es2017\"}" scripts/backfill-decision-ledger-english.ts`
Expected: rows updated where render input is recoverable

- [ ] **Step 3: Verify ledger traces are now English**

Run a raw query against `decision_ledger`
Expected: recent `logical_inference` values are English

### Task 10: Update Repo Docs And Final Verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Replace old `Mira / gpt-4o / French-only` assumptions with:
- multilingual LEIA
- English internal traces
- Whisper auto-detection

- [ ] **Step 2: Run the full verification set**

Run:
- `npm test`
- `npm run test:mira-math`
- `npm run test:mira-invariant`
- `npx tsc --noEmit`

Expected:
- all pass

- [ ] **Step 3: Run multilingual smoke checks**

Test prompts:
- `Bonjour LEIA, qu'est-ce qui se passe ?`
- `Hello LEIA, what's happening?`
- `Ciao LEIA, cosa succede?`
- `Hallo LEIA, was ist los?`
- `Hola LEIA, qué pasa?`

Also verify:
- mid-conversation switch to English
- voice EN returns EN
- voice FR returns FR
- English internal traces remain untouched in DB
