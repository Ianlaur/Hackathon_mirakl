# Hackathon Mirakl x Eugenia — UC1 Agent Led Merchant Company

Projet Nathan (rôle CTO) sur la branche `nathan-calendar-advisor` (mirror équipe : `ianlaur/nathan-iris`). Pitch final **VEN 24 avril 2026, 14h** dans les locaux Mirakl.

## Current Project State

| Aspect | Status |
|---|---|
| Mascotte **Mira** (orbe flottant + chat Spotlight) | ✅ Intégrée sur toutes les pages |
| Chat tool-using (`/api/mascot/chat`, gpt-4o) | ✅ 7 tools branchés (stock + calendar + restock + emails) |
| **Calendar-Aware Restock Advisor** | ✅ Endpoint + logique + UI `/actions` |
| Inbox `/actions` (approve/reject + tableau SKU) | ✅ Défensif vs anciennes recos |
| Input vocal Whisper (`/api/mascot/transcribe`) | ✅ MediaRecorder + OpenAI whisper-1 |
| Rendu markdown dans bulles assistant | ✅ react-markdown + remark-gfm |
| Workflow n8n (`workflows/calendar-advisor.json`) | ✅ Fichier exportable (non déployé) |
| Merge avec `ianlaur/dev` | ✅ Module `/copilot` équipier coexiste avec Mira |
| Tests vitest (`src/tests/`) | ✅ 15/15 verts (lib calendar-restock) |
| Build Next.js | ✅ OK en dernière vérif |
| Clé `OPENAI_API_KEY` dans `src/.env` | ✅ Configurée (gitignored) |
| BDD Supabase (produits, recos, events) | ✅ 200 products Nordika importés, BDD nettoyée |
| Déploiement Vercel | ❌ Pas encore fait |
| n8n VPS branché en live | ❌ JSON prêt, à importer + configurer `APP_BASE_URL` |
| Loom / deck / doc tech | ❌ À faire avant VEN 8h |

## Next Immediate Action

**Relancer le dev server pour démo** :
```bash
cd "C:/Users/skwar/Desktop/hackaton/hackaton-mirakl/src"
npm run dev
```
Puis tester : ouvrir `http://localhost:3000/dashboard`, cliquer sur l'orbe (bas-droite), vérifier que Mira répond (placeholder animé visible → *"combien de stock j'ai"* → appel tool `get_stock_summary`).

**Si l'erreur `Cannot find module './9276.js'` revient** :
```bash
taskkill //F //IM node.exe && rm -rf "C:/Users/skwar/Desktop/hackaton/hackaton-mirakl/src/.next" && cd src && npm run dev
```

**Prochaine feature possible** (si demandée) : déploiement Vercel + branchement n8n VPS en live (voir `docs/n8n-setup.md`).

## Architecture

```
Dashboard/ Stock/ Actions/ Calendar
       └─ [AppShell]
            └─ <MascotOrb /> (fixed bottom-right, visible partout)
                 └─ click → <MascotChatDrawer /> (overlay Spotlight, backdrop-blur)
                      ├─ textarea auto-grow + placeholder typing animé
                      ├─ bouton micro → POST /api/mascot/transcribe (Whisper)
                      ├─ submit → POST /api/mascot/chat (gpt-4o tool use)
                      │    ├─ get_stock_summary / get_product_by_sku / search_products
                      │    ├─ list_pending_actions
                      │    ├─ create_calendar_event (leave → trigger advisor)
                      │    ├─ propose_restock_plan
                      │    └─ draft_supplier_emails
                      ├─ ReactMarkdown sur bulles assistant
                      └─ Cards récap : EventRecapCard, RestockPlanCard, EmailDraftCard

[calendar_events INSERT kind=leave]
    └─ notifyN8n (fire-and-forget, non-blocking)
         └─ webhook n8n (si N8N_WEBHOOK_URL défini)
              └─ POST /api/agent/calendar-advisor {event_id, user_id}
                   ├─ lib/calendar-restock.ts (projection déterministe)
                   ├─ lib/calendar-restock-llm.ts (enrichissement + fallback)
                   └─ INSERT agent_recommendations (scenario=calendar_restock_plan)
                        └─ visible dans /actions
```

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/components/MascotOrb.tsx` | Orbe flottant + animations fumée |
| `src/components/MascotChatDrawer.tsx` | Overlay Spotlight + chat + markdown + cards |
| `src/components/useAudioRecorder.ts` | Hook MediaRecorder + cleanup |
| `src/lib/mascot-tools.ts` | 7 tool definitions + executors (Prisma) |
| `src/app/api/mascot/chat/route.ts` | gpt-4o loop tool use + SYSTEM_PROMPT XML |
| `src/app/api/mascot/transcribe/route.ts` | Relay multipart vers OpenAI Whisper |
| `src/app/api/agent/calendar-advisor/route.ts` | Agent restock (lecture BDD + reco) |
| `src/app/actions/*` | Inbox page + card + detail panel avec approve/reject |
| `src/app/globals.css` | Tous les styles `iris-*` (nom CSS historique, visible = Mira) |
| `src/lib/calendar-restock.ts` | Logique pure projection (testée) |
| `src/scripts/cleanup-level-1.ts` | Purge BDD des artefacts de test (100 rows) |
| `workflows/calendar-advisor.json` | Workflow n8n exportable |
| `docs/superpowers/specs/2026-04-21-calendar-aware-restock-advisor-design.md` | Spec complet |
| `docs/superpowers/plans/2026-04-21-calendar-aware-restock-advisor.md` | Plan 11 tâches |
| `docs/demo-script.md` | Script Loom shot-by-shot 90s |
| `docs/n8n-setup.md` | Guide d'activation n8n en prod |

## Git

- **Branche locale** : `nathan-calendar-advisor`
- **Remote origin** : fork perso `solanathouu/hackathon-mirakl-nordika`
- **Remote ianlaur** : repo équipe `Ianlaur/Hackathon_mirakl` (branche `nathan-iris`)
- **PR équipe** : https://github.com/Ianlaur/Hackathon_mirakl/pull/4
- Pour push sur les 2 remotes en même temps :
  ```bash
  git push origin nathan-calendar-advisor && \
    git push ianlaur nathan-calendar-advisor:nathan-iris
  ```

## Commandes utiles

```bash
# Dev server
cd src && npm run dev

# Tests
cd src && npm test

# Type-check (sans toucher .next, safe même avec dev server qui tourne)
cd src && npx tsc --noEmit --pretty

# Build prod (⚠️ kill le dev server avant sinon EPERM Prisma + chunks périmés)
cd src && npx next build

# Dry-run BDD (compte les rows par table)
cd src && npx ts-node --compiler-options "{\"module\":\"CommonJS\",\"target\":\"es2017\"}" scripts/dryrun-cleanup.ts

# Cleanup BDD niveau 1 (supprime recos + alertes + events leave tests)
cd src && npx ts-node --compiler-options "{\"module\":\"CommonJS\",\"target\":\"es2017\"}" scripts/cleanup-level-1.ts

# Seed démo (reset stock + crée event leave)
cd src && npx ts-node --compiler-options "{\"module\":\"CommonJS\",\"target\":\"es2017\"}" scripts/seed-demo-scenario.ts
```

## Env vars requises (`src/.env`)

```
DATABASE_URL=postgresql://...supabase.com:5432/postgres
DIRECT_URL=postgresql://...supabase.co:5432/postgres
HACKATHON_USER_ID=00000000-0000-0000-0000-000000000001
OPENAI_API_KEY=sk-proj-...            # Mira chat + Whisper
N8N_WEBHOOK_URL=                      # optionnel, seulement si n8n actif
DUST_ORCHESTRATOR_AGENT_ID=           # utilisé par le module /copilot de l'équipe
DUST_ORCHESTRATOR_API_KEY=
```

## Points d'attention

- **Cache `.next` se corrompt** quand dev server tourne pendant un `next build` ou gros refactor. Réflexe : `taskkill //F //IM node.exe && rm -rf src/.next && npm run dev`.
- **Classes CSS `.iris-*`** sont historiques (nom initial Iris). Elles ne sont PAS renommées en `.mira-*` — détail interne non visible.
- **Module `/copilot` équipe coexiste** avec Mira depuis le merge du 22/04. La sidebar n'a pas de lien vers `/copilot` (retiré par moi). Si l'équipe veut le remettre : 1 ligne dans `src/components/Sidebar.tsx`.
- **Workflow n8n n'est PAS actif par défaut** — le JSON est livré comme asset (livrable Rendu #2). Pour l'activer en réel : voir `docs/n8n-setup.md`.
- **Démo locale sans n8n** : l'appel direct à `/api/agent/calendar-advisor` est fait via `fetch` dans `create_calendar_event` (côté `lib/mascot-tools.ts`) — donc la chaîne leave → reco fonctionne même sans n8n. Si `N8N_WEBHOOK_URL` vide, le webhook est skippé mais Mira déclenche quand même l'advisor.

## Reprise rapide (30 secondes)

1. Lire cette section "Current Project State"
2. Exécuter "Next Immediate Action"
3. Si questionnement sur une feature → ouvrir le spec dans `docs/superpowers/specs/`
4. Si bug UI → `tsc --noEmit` d'abord, puis inspecter le log dev server
