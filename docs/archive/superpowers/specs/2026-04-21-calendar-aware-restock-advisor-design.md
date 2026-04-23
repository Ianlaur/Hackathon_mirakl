# Calendar-Aware Restock Advisor — Design Spec

**Date** : 2026-04-21
**Contexte** : Hackathon Mirakl x Eugenia, UC1 Agent Led Merchant Company
**Persona** : Jean-Charles, vendeur de tables en Savoie (déclinaison Nordika Studio)
**Deadline** : Rendu #2 vendredi 24 avril 2026, 8h

---

## 1. Vision

Quand l'utilisateur crée un événement `kind=leave` (congés) dans son calendrier, un agent analyse son stock, le croise avec la vélocité de vente et les délais fournisseurs, et crée **une seule recommandation agrégée "Plan congés"** dans l'inbox `/actions`. L'utilisateur approuve en un clic avant de partir — son business tourne pendant son absence.

L'agent n'est pas réactif (stock bas → alerte) mais **anticipatif** (événement calendrier à venir × projection stock × délai fournisseur → conseil avec timing ajusté).

---

## 2. Problème adressé

Un vendeur solo multi-marketplaces ne peut pas se permettre de partir en vacances sans :
- risquer des ruptures pendant son absence (vente perdue, dégradation ranking marketplace)
- passer des heures à calculer manuellement : pour chaque SKU → vélocité × jours d'absence × délai fournisseur → deadline commande
- oublier un SKU critique dans le calcul

Le calendrier actuel affiche les événements mais ne les traduit pas en actions opérationnelles. Cette feature ferme la boucle : **calendrier → analyse stock → recommandation actionnable**.

---

## 3. Parti pris

- **Une seule recommandation agrégée** pour la période d'absence (pas N recos individuelles). UX solo entrepreneur : "1 clic, c'est géré".
- **Restock uniquement** en v1 (pas CS, pas transport). Scope volontairement resserré pour hackathon.
- **Human-in-the-loop obligatoire** : l'agent propose, l'utilisateur valide. Matche le pattern `approval_required` existant.
- **Raisonnement hybride** : déterministe (SQL) filtre les SKUs à risque → LLM enrichit avec reasoning narratif et priorisation.
- **Orchestration n8n visible** dans les slides/livrables (export JSON workflow demandé au Rendu #2), même si l'essentiel tourne dans Next.js.

---

## 4. Architecture

### 4.1 Flux de données

```
[User] crée CalendarEvent (kind=leave) via /calendar
    │
    ▼ (Supabase webhook INSERT/UPDATE)
[n8n webhook node]
    │
    ▼ (HTTP POST)
[/api/agent/calendar-advisor] (Next.js route handler)
    │
    ├── 1. SELECT event details
    ├── 2. SELECT products actifs + velocity via data_orders_amazon/google (60j)
    ├── 3. Logique déterministe : projection stock sur période
    │       → filtre SKUs à risque
    ├── 4. LLM OpenAI : enrichissement reasoning + priorisation FR
    └── 5. INSERT agent_recommendations (scenario_type='calendar_restock_plan')
    │
    ▼
[Dashboard /actions]
    │
    ├── User consulte → voit Plan avec N items
    ├── Décoche éventuellement des lignes
    └── Approuve
    │
    ▼
[/api/copilot/recommendations/[id]/approve]
    │
    └── Génère stock_movements (réservation) + tasks commande fournisseur

[n8n cron quotidien 07:00]
    │
    └── Re-check events leave dans les 30j → patch reco si drift
```

### 4.2 Composants

| Composant | État | Responsabilité |
|---|---|---|
| `src/app/api/agent/calendar-advisor/route.ts` | **NOUVEAU** | Endpoint appelé par n8n, orchestre la logique |
| `src/lib/calendar-restock.ts` | **NOUVEAU** | Calcul déterministe : vélocité + projection + détection risque |
| `workflows/calendar-advisor.json` | **NOUVEAU** | Workflow n8n exportable (webhook + cron + HTTP) |
| `src/app/actions/page.tsx` + client | **NOUVEAU** | Inbox dédiée recommandations (vue dédiée, pas dans /copilot) |
| `CalendarEvent` | existant | Table source du déclencheur (filtrer `kind='leave'`) |
| `AgentRecommendation` | existant | Destination de la recommandation (nouveau `scenario_type`) |
| `/api/copilot/recommendations/[id]/approve\|reject` | existant | Approve/reject workflow déjà en place |
| `data_orders_amazon`, `data_orders_google` | existant | Source vélocité réelle (496 + 257 lignes Nordika) |
| `data_supplier_catalog_nordika_200` | existant | Catalogue source 200 SKUs |

---

## 5. Modèle de données

### 5.1 Pas de nouvelle table
Réutilisation de `AgentRecommendation` existant.

### 5.2 Nouveau `scenario_type`
```
scenario_type = 'calendar_restock_plan'
```

### 5.3 Shape de `action_payload`

```json
{
  "leave_event_id": "uuid",
  "leave_start": "2026-05-10",
  "leave_end": "2026-05-20",
  "leave_duration_days": 10,
  "order_deadline": "2026-05-07",
  "total_estimated_cost_eur": 2430.0,
  "items_count": 5,
  "items": [
    {
      "product_id": "uuid",
      "sku": "NKS-00042",
      "product_name": "Chaise Oslo bouclette crème",
      "current_stock": 8,
      "velocity_per_day": 0.9,
      "projected_stock_end_of_leave": -14,
      "recommended_qty": 50,
      "supplier": "Scandi Wood Co",
      "lead_time_days": 7,
      "unit_cost_eur": 12.80,
      "estimated_cost_eur": 640.0,
      "priority": "critical",
      "reasoning": "Stock actuel couvre 9 jours ; absence + délai fournisseur = 17 jours. Rupture estimée J+14 après départ."
    }
  ]
}
```

### 5.4 Shape de `evidence_payload`

```json
[
  { "label": "Période d'absence", "value": "10-20 mai 2026 (10j)" },
  { "label": "SKUs analysés", "value": "147" },
  { "label": "SKUs à risque", "value": "5" },
  { "label": "Deadline commande", "value": "7 mai 2026" },
  { "label": "Coût total estimé", "value": "2 430 €" },
  { "label": "Événements commerce coïncidant", "value": "Aucun" }
]
```

---

## 6. Logique de calcul (déterministe)

### 6.1 Input
- `leave_event_id` : identifiant de l'événement calendrier (kind='leave')
- `user_id` : merchant propriétaire

### 6.2 Pseudo-code

```typescript
const event = await getCalendarEvent(leave_event_id)
const leave_start = event.start_at
const leave_end = event.end_at
const leave_duration = daysBetween(leave_start, leave_end)

const products = await getActiveProducts(user_id)
const plan_items = []

for (const product of products) {
  // Velocité quotidienne sur les 60 derniers jours
  const orders_60d = await countOrders(product.sku, last_60_days)
  const velocity_day = orders_60d / 60

  if (velocity_day === 0) continue  // SKU dormant, ignorer

  const lead_time = product.supplier_lead_time_days ?? 7  // fallback mock
  const current_stock = product.quantity
  const days_covered = current_stock / velocity_day

  // Horizon critique : jusqu'au retour + délai de réapprovisionnement
  const days_until_safe = daysBetween(today, leave_end) + lead_time

  if (days_covered >= days_until_safe) continue  // OK, pas de risque

  // Calcul quantité à commander avec safety factor 1.2
  const qty_needed = Math.ceil(
    velocity_day * (leave_duration + lead_time) * 1.2
  ) - current_stock

  const order_deadline = subtractDays(leave_start, lead_time + 2)  // buffer 2j

  const priority =
    days_covered < daysBetween(today, leave_start) ? 'critical' :
    days_covered < daysBetween(today, leave_end)   ? 'high'     :
    'medium'

  plan_items.push({
    product_id: product.id, sku: product.sku,
    current_stock, velocity_per_day: velocity_day,
    projected_stock_end_of_leave: current_stock - velocity_day * leave_duration,
    recommended_qty: qty_needed,
    supplier: product.supplier,
    lead_time_days: lead_time,
    unit_cost_eur: product.purchase_price,
    estimated_cost_eur: qty_needed * product.purchase_price,
    priority,
    order_deadline,
  })
}
```

### 6.3 Fallback vélocité
Si un SKU n'a aucune commande sur 60j → exclus du plan (pas de prédiction fiable).
Si `supplier_lead_time_days` manquant → valeur par défaut = 7 jours (mock).

---

## 7. Enrichissement LLM

### 7.1 Appel
Réutilise le pattern `callOpenAI` de `src/lib/copilot.ts`. Model par défaut `gpt-4.1-mini` (config user).

### 7.2 Prompt système
```
You are an operations advisor for a solo merchant preparing for a leave period.
Given the leave event, the list of at-risk SKUs with deterministic calculations,
and any calendar events coinciding with the leave, produce a JSON object with:
- reasoning_summary: narrative explanation in FRENCH (2-4 sentences, empathetic tone)
- priority_adjustments: array of {product_id, new_priority, rationale} if any SKU should be re-prioritized
- supplementary_notes: array of strings (e.g. "Nouvel An chinois tombe pendant tes congés, ton fournisseur asiatique sera fermé")
Respond only in valid JSON.
```

### 7.3 Input
```json
{
  "leave_event": { "start": "...", "end": "...", "title": "..." },
  "at_risk_items": [ /* plan_items from deterministic pass */ ],
  "coinciding_calendar_events": [ /* CalendarEvent rows overlapping leave */ ],
  "merchant_profile": { /* from MerchantProfileContext */ }
}
```

### 7.4 Fallback
Si le LLM plante (timeout, quota, JSON malformé) : on conserve le `reasoning_summary` par défaut déterministe (ex : "5 SKUs risquent la rupture pendant ton absence. Commande avant le 7 mai pour être livré à temps."). Pattern déjà présent dans `generateCopilotResponse`.

---

## 8. UX `/actions`

### 8.1 Card inbox
```
┌─────────────────────────────────────────────────────────────┐
│ 🏖️  Plan congés 10-20 mai                    [pending]     │
│                                                             │
│ 5 commandes fournisseur à passer d'ici le 7 mai             │
│ Total estimé : 2 430 €                                      │
│                                                             │
│                       [Détail]  [Approuver]  [Rejeter]     │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Vue détail
- **Bandeau haut** : "Congés Savoie 10-20 mai — 10 jours sans expédition"
- **Reasoning IA** : paragraphe narratif FR (2-4 phrases)
- **Deadline commande** : mise en avant visuelle (badge rouge si < 7j)
- **Tableau SKU** :
  | Priorité | SKU | Produit | Stock actuel | Projection fin congés | Reco qty | Fournisseur | Coût | ☑ |
  |---|---|---|---|---|---|---|---|---|
  | 🔴 critical | NKS-00042 | Chaise Oslo | 8 | -14 | 50 | Scandi Wood | 640 € | ☑ |
- **Actions bas de page** : `[Approuver tout]` / `[Approuver sélection]` / `[Rejeter]`

### 8.3 Widget dashboard
Sur `/dashboard`, card "Actions en attente" avec compteur + preview 2-3 recos pending.

### 8.4 Principe UX
**UX "sans IA apparente"** : pas de chat, pas de bulles conversation, pas de "demandez à l'agent". L'utilisateur voit des "choses à valider" comme une inbox Gmail. L'IA est dans les coulisses, pas dans l'interface.

---

## 9. Trigger (n8n)

### 9.1 Webhook event-driven
- Node `Supabase Trigger` (ou webhook HTTP exposé par un trigger Postgres) : écoute `INSERT OR UPDATE ON calendar_events WHERE kind='leave'`
- Node `HTTP Request` : POST vers `https://<app>/api/agent/calendar-advisor` avec `{ event_id, user_id }`

### 9.2 Cron quotidien
- Node `Cron` : tous les jours 07:00 UTC
- Node `HTTP Request` : GET `/api/agent/calendar-advisor/refresh` qui re-check les events `leave` dans les 30j à venir et met à jour les recos pending (drift vélocité, nouveaux orders, changement de stock)

### 9.3 Fallback plan-B démo
Ajouter un endpoint `/api/agent/calendar-advisor/trigger?event_id=...` appelable directement depuis l'UI (bouton caché ou route debug) pour re-jouer la démo live si n8n plante.

---

## 10. Scénario démo (Loom + pitch)

**Durée cible** : 90 secondes sur les 5-8 min du Loom.

1. `[00:00]` Jean-Charles ouvre `/calendar`, contexte : "il veut partir 10 jours en Savoie".
2. `[00:10]` Il crée un événement "Congés Savoie" du 10 au 20 mai (kind=leave).
3. `[00:20]` Transition rapide vers `/actions`, badge compteur passe à "+1" en direct.
4. `[00:25]` Il clique sur la reco "Plan congés 10-20 mai".
5. `[00:35]` Vue détail : 5 SKUs, tableau, reasoning IA en FR. On lit le premier item à voix haute.
6. `[00:55]` Il décoche 1 ligne ("celle-là je gère moi-même") et clique "Approuver sélection".
7. `[01:05]` Confirmation : "4 commandes créées, fournisseurs notifiés".
8. `[01:15]` Bandeau visuel ou voiceover : **"Jean-Charles peut partir. Le business continue sans lui."**

Closing pitch : "L'agent ne gère pas tout pour lui — il lui rend le contrôle. Jean-Charles décide, l'agent fait les calculs."

---

## 11. Scaling (10k SKUs)

Pour un catalogue 10 000 SKUs (vs 200 Nordika) :
- **Calcul déterministe** : 1 query SQL agrégée (`SELECT product_id, count(orders)/60 as velocity FROM ... GROUP BY product_id`). O(n), reste sous la seconde.
- **LLM** : traite uniquement les SKUs à risque (typiquement 20-200, pas 10k). Coût token constant par reco.
- **n8n** : si nécessaire, chunker les SKUs par lot de 500 et paralléliser (workflow subflow).
- **Inbox** : une seule reco agrégée par event leave → pas d'explosion du nombre d'entrées dans `/actions`.

---

## 12. Limites connues & v2

### v1 (vendredi 24 avril)
- Restock uniquement (pas CS, pas transport)
- Fournisseurs mockés (4-5 fournisseurs plausibles avec lead_time fixe)
- Vélocité = moyenne simple sur 60j (pas de saisonnalité fine)
- Pas de ré-approvisionnement automatique (l'utilisateur valide manuellement chaque fois)

### v2 post-hackathon
- Saisonnalité : vélocité pondérée par événements commerce sur même période N-1
- Fournisseurs réels via connecteurs (email, EDI, API)
- Exécution automatique pour SKUs low-priority (si `autonomy_mode = 'autonomous'`)
- Extension aux 4 autres scenarios (`transport_delay`, `demand_event`, `calendar_absence` non-restock, `stock_rebalance`)
- CS multilingue pendant l'absence (auto-reply FR/IT/DE)

---

## 13. Cost run (FinOps slide)

Estimation par événement `leave` traité :
- **LLM** : ~1 call `gpt-4.1-mini` avec 2-3k tokens input + 1k output ≈ **0.003 €/reco**
- **n8n** : coût fixe infrastructure (cloud n8n ou self-hosted, ~20 €/mois)
- **Next.js/Supabase** : déjà utilisés pour le reste de l'app, coût marginal nul
- **Cron quotidien** : 1 re-check par event leave pending (max 5-10 events/mois typiquement) ≈ 0.03 €/jour

**Coût total estimé** : ~5-10 €/mois par merchant actif.

---

## 14. Ce qui existe déjà dans le codebase (branche `ianlaur/dev`)

Pour éviter duplication, ces éléments sont **déjà prêts** :
- Modèle `CalendarEvent` + seed jours fériés FR 2026 + temps forts commerce
- Modèle `AgentRecommendation` + `approvals` + `execution_runs`
- Routes API `/api/copilot/recommendations` + `[id]/approve` + `[id]/reject`
- `src/lib/copilot.ts` : pattern `buildHeuristicSuggestions` + `callOpenAI` + fallback
- `MerchantAiSettings` (API key encryptée) + `MerchantProfileContext` (seasonality, suppliers...)
- Données Nordika importées : 496+257 orders, 200 products, 200 supplier catalog

## 15. Ce qui reste à coder (gap analysis)

| Item | Type | Priorité | Estimation |
|---|---|---|---|
| `POST /api/agent/calendar-advisor` route | backend | critique | 2h |
| `lib/calendar-restock.ts` logique projection | backend | critique | 3h |
| Scenario type `'calendar_restock_plan'` dans le switch UI | backend | haute | 30min |
| Route `/actions` + client inbox | frontend | haute | 3h |
| Widget "Actions pending" sur `/dashboard` | frontend | moyenne | 1h |
| Workflow n8n JSON (webhook + cron + HTTP) | infra | haute | 2h |
| Mock fournisseurs (seed 4-5 avec lead_time, cost) | data | haute | 1h |
| Scénario démo scripté avec seed events/stock | démo | critique | 2h |
| Fallback `/trigger?event_id=...` debug | infra | moyenne | 30min |

**Total estimé** : ~15h de dev (1.5 jour plein) → réalisable sur mercredi-jeudi, pitch vendredi matin.

---

## 16. Livrables mappés au Rendu #2

- **Loom 5-8min** : scénario §10 + architecture §4 rapide
- **Slide deck** : problème §2, parti pris §3, archi §4, démo §10 (4-5 slides de screenshots), limites §12, FinOps §13
- **Doc technique** : ce document + README technique d'intégration
- **Exports techniques** : workflow n8n JSON `workflows/calendar-advisor.json`, prompts OpenAI §7.2, repo GitHub

---

## 17. Acceptance criteria

- [ ] Créer un event `kind=leave` dans `/calendar` déclenche un appel à l'endpoint agent en < 5s
- [ ] L'endpoint produit une reco `AgentRecommendation` avec `scenario_type='calendar_restock_plan'` et `action_payload` conforme §5.3
- [ ] La reco apparaît dans `/actions` avec card §8.1
- [ ] Le clic "Détail" affiche la vue §8.2 avec tableau SKU
- [ ] "Approuver sélection" crée les stock_movements + tasks correspondantes et passe la reco en `status='approved'`
- [ ] "Rejeter" passe la reco en `status='rejected'` sans effet de bord
- [ ] Le cron quotidien re-calcule les recos pending si > 24h
- [ ] Fallback déterministe fonctionne si OpenAI indisponible (vérifiable en coupant la clé)
- [ ] Scénario démo §10 jouable en < 90s sans bug

---

**End of spec.**
