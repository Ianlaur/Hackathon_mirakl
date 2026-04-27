# Hackathon Mirakl x Eugenia — UC1 Agent Led Merchant Company

Projet Nathan (rôle CTO). Pitch final **VEN 24 avril 2026, 14h** dans les locaux Mirakl — **livré et présenté**. État actuel : post-pitch, deck prêt à partager, code stable.

## Current Project State

| Aspect | Status |
|---|---|
| Pitch oral du 24/04 14h | ✅ Présenté |
| **Leia** (anciennement Mira) — orbe + chat + nom unifié EN partout | ✅ |
| Modèle OpenAI standardisé sur **gpt-4.1** (Leia + calendar advisor + mascot) | ✅ Migré depuis gpt-4o + gpt-4.1-mini |
| Leia répond toujours en **anglais** (system prompt + suggestions UI) | ✅ |
| Calendar-Aware Restock Advisor | ✅ Endpoint + logique + UI `/actions` |
| Inbox `/actions` (approve/reject + tableau SKU) | ✅ |
| Input vocal Whisper | ✅ |
| Workflow n8n (`workflows/calendar-advisor.json`) | ✅ Fichier exportable |
| Tests vitest (lib calendar-restock) | ✅ 15/15 verts |
| BDD Supabase (200 produits Nordika) | ✅ |
| **Pitch deck éditorial 11 slides** (`docs/pitch/`) | ✅ EN + FR |
| Pitch deck — version standalone autoportante (images base64) | ✅ EN + FR |
| Photos Jean-Charles base + Pro Max (Nano Banana) | ✅ Intégrées |
| Branche `feat/leia-unify-english` ouverte sur PR ianlaur#9 | ✅ |
| Déploiement Vercel | ❌ Pas fait |
| n8n VPS branché en live | ❌ JSON prêt, non déployé |

## Next Immediate Action

**Si modif du pitch deck** :
```bash
# 1. Éditer la version de travail FR ou EN
code docs/pitch/pitch-leia.html       # version anglaise
code docs/pitch/pitch-leia-fr.html    # version française

# 2. Regénérer les standalone (images inline base64)
python docs/pitch/_inline-images.py
```
Output : `pitch-leia-standalone.html` + `pitch-leia-fr-standalone.html` (5,6 Mo chacun, autoportants — un seul fichier à envoyer).

**Si reprise du dev applicatif** :
```bash
cd "C:/Users/skwar/Desktop/hackaton/hackaton-mirakl/src" && npm run dev
```
Tester Leia sur `http://localhost:3000/dashboard` (orbe bas-droite → chat anglais).

**Si erreur cache `.next`** :
```bash
taskkill //F //IM node.exe && rm -rf src/.next && cd src && npm run dev
```

## Architecture

```
Dashboard / Stock / Actions / Calendar
       └─ [AppShell]
            └─ <MascotOrb /> (fixed bottom-right) — connue sous Leia
                 └─ click → <MascotChatDrawer />
                      ├─ textarea + placeholder typing animé
                      ├─ micro → POST /api/mascot/transcribe (Whisper)
                      ├─ submit → POST /api/mascot/chat (gpt-4.1, EN)
                      │    ├─ get_stock_summary / get_product_by_sku / search_products
                      │    ├─ list_pending_actions
                      │    ├─ create_calendar_event (leave → trigger advisor)
                      │    ├─ propose_restock_plan
                      │    └─ draft_supplier_emails
                      └─ Cards : EventRecapCard, RestockPlanCard, EmailDraftCard

[calendar_events INSERT kind=leave]
    └─ notifyN8n (fire-and-forget)
         └─ POST /api/agent/calendar-advisor (gpt-4.1)
              └─ INSERT agent_recommendations (scenario=calendar_restock_plan)
                   └─ visible dans /actions
```

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/components/MascotOrb.tsx` | Orbe flottant Leia |
| `src/components/MascotChatDrawer.tsx` | Overlay Spotlight + chat + cards |
| `src/lib/mascot-tools.ts` | 7 tools Prisma |
| `src/app/api/mascot/chat/route.ts` | gpt-4.1 tool use + system prompt EN |
| `src/app/api/mascot/transcribe/route.ts` | Relay Whisper |
| `src/app/api/agent/calendar-advisor/route.ts` | Agent restock |
| `src/lib/copilot.ts` | Module copilot (Leia ChatBar dashboard, gpt-4.1) |
| `src/components/copilot/SmartChat.tsx` | UI Leia ChatBar |
| `src/app/actions/*` | Inbox + approve/reject |
| `src/lib/calendar-restock.ts` | Logique pure projection (15 tests) |
| **`docs/pitch/pitch-leia.html`** | **Pitch deck EN — version travail (chemins relatifs)** |
| **`docs/pitch/pitch-leia-fr.html`** | **Pitch deck FR — version travail** |
| **`docs/pitch/_inline-images.py`** | **Script qui génère les standalone autoportants** |
| `docs/pitch/jean-charles.png` | Portrait JC base (Nano Banana) |
| `docs/pitch/jean-charles-pro-max.png` | Portrait JC Pro Max (Nano Banana) |
| `docs/pitch/dashboard.png` | Screenshot dashboard pour slide 7 |
| `workflows/calendar-advisor.json` | Workflow n8n exportable |

## Pitch deck — récap structure (11 slides)

1. **Title** — *Jean-Charles didn't ask for AI. He asked for a breath.*
2. **Jean-Charles (base)** — portrait + 6 facts + douleur (3.5h/day, €12k/quarter)
3. **Jean-Charles Pro Max** — portrait + 6 facts + douleur (40h/week team, €180k/year)
4. **The truth** — *Jean-Charles doesn't want AI.*
5. **The original question** — recall : *How to automate marketplace operations without losing control?*
6. **Leia, the invisible agent** — schema before/after workflow
7. **What Jean-Charles sees** — dashboard screenshot
8. **A conversation** — 2 chat exchanges (leave + stock check)
9. **The rule** — *Leia proposes. Jean-Charles decides.*
10. **What changes** — before/after metrics
11. **Thank you, Mirakl.**

**Design** : palette papier crème (`#F5F0E6`) + encre navy (`#03182F`), typographie Fraunces serif + Instrument Sans + Instrument Serif italic, zéro card boxy, aération éditoriale.

**Mode édition inline** : touche `E` pour activer, `Ctrl+S` pour exporter, `Ctrl+R` pour reset, auto-save localStorage par version (clé bumpée `v10-en-noadapt` / `v10-fr`).

## Git

- **Branche locale** : `feat/leia-unify-english`
- **Remote ianlaur** : `Ianlaur/Hackathon_mirakl`
- **PR équipe** : https://github.com/Ianlaur/Hackathon_mirakl/pull/9 (Leia unification + EN + gpt-4.1)
- **PR antérieure** (Mira/n8n) : https://github.com/Ianlaur/Hackathon_mirakl/pull/4

Push direct sur `dev` bloqué par le harness — toujours passer par feature branch + PR.

## Commandes utiles

```bash
# Dev server
cd src && npm run dev

# Tests
cd src && npm test

# Type-check
cd src && npx tsc --noEmit --pretty

# Build prod (kill dev server avant)
cd src && npx next build

# Générer les pitch standalones (images inline)
python docs/pitch/_inline-images.py
```

## Env vars (`src/.env`)

```
DATABASE_URL=postgresql://...supabase.com:5432/postgres
DIRECT_URL=postgresql://...supabase.co:5432/postgres
HACKATHON_USER_ID=00000000-0000-0000-0000-000000000001
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=                         # optionnel — défaut gpt-4.1
N8N_WEBHOOK_URL=                      # optionnel
DUST_ORCHESTRATOR_AGENT_ID=
DUST_ORCHESTRATOR_API_KEY=
```

## Points d'attention

- **Mira → Leia** : tous les usages user-facing renommés. Les classes CSS `.iris-*` historiques restent (jamais visibles côté UI).
- **gpt-5 testé et écarté** : c'est un reasoning model qui rejette `temperature: 0.2` et brûle des tokens en reasoning. `gpt-4.1` est le dernier flagship non-reasoning compatible avec le code existant.
- **Override modèle** : la variable `OPENAI_MODEL` dans `.env` permet de switcher sans toucher au code (ex: `OPENAI_MODEL=gpt-4o` si besoin).
- **Cache `.next` se corrompt** facilement → réflexe : `taskkill //F //IM node.exe && rm -rf src/.next`.
- **Pitch deck** :
  - Toujours éditer `pitch-leia.html` ou `pitch-leia-fr.html` (versions de travail légères, 53 Ko).
  - Les `*-standalone.html` (5,6 Mo) sont **regénérés** par `_inline-images.py` — gitignored.
  - localStorage clé distincte par langue pour éviter les collisions d'édition.
- **Workflow n8n n'est PAS actif** — JSON livré comme asset. Démo locale fonctionne sans n8n grâce au fetch direct dans `lib/mascot-tools.ts`.

## Reprise rapide (30 secondes)

1. Lire "Current Project State" + "Next Immediate Action".
2. Si modification deck : `python docs/pitch/_inline-images.py` après édition.
3. Si dev applicatif : `cd src && npm run dev` puis `localhost:3000/dashboard`.
4. Si bug UI : `tsc --noEmit` puis log dev server.
