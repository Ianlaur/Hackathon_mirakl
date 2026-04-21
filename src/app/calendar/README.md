# Feature Calendrier

Route :

```text
/calendar
```

Objectif : centraliser les événements qui peuvent impacter les opérations, le stock, la logistique ou le commerce.

La feature sert à suivre :

- jours fériés
- temps forts commerce
- périodes sensibles logistiques
- congés / vacances utilisateur
- événements internes
- événements créés manuellement depuis l'interface

## Fichiers

```text
src/app/calendar/page.tsx
src/app/calendar/CalendarPageClient.tsx
src/app/api/calendar-events/route.ts
src/app/api/calendar-events/[id]/route.ts
```

Entrées navigation :

```text
src/components/Sidebar.tsx
src/app/dashboard/page.tsx
```

## Table Supabase

Table utilisée :

```text
public.calendar_events
```

Colonnes principales :

```text
id uuid
user_id uuid
title text
start_at timestamptz
end_at timestamptz
kind text
impact text
zone text
notes text
locked boolean
created_at timestamptz
updated_at timestamptz
```

Les dates sont stockées en timestamp Supabase :

- `start_at` : début de l'événement
- `end_at` : fin de l'événement
- `created_at` : création
- `updated_at` : dernière modification

Pour les événements sans heure, l'API utilise `12:00` comme valeur technique afin d'éviter les décalages de date liés aux fuseaux horaires. Côté UI, ces événements restent affichés comme des événements sans heure.

## API

Lister les événements :

```http
GET /api/calendar-events
```

Créer un événement :

```http
POST /api/calendar-events
```

Mettre à jour un événement :

```http
PATCH /api/calendar-events/:id
```

Supprimer un événement :

```http
DELETE /api/calendar-events/:id
```

Les routes API utilisent :

- `getCurrentUserId()` pour isoler les données utilisateur
- Zod pour valider les inputs
- Prisma avec requêtes SQL paramétrées vers `public.calendar_events`

Note importante : l'API utilise volontairement des requêtes SQL via `prisma.$queryRaw` / `prisma.$executeRaw` au lieu du delegate typé `prisma.calendarEvent`. Cela évite qu'un collègue doive régénérer le client Prisma immédiatement après un simple pull pour que l'API compile et fonctionne.

## Types D'Événements

Valeurs possibles pour `kind` :

```text
commerce
holiday
leave
logistics
marketing
internal
```

Valeurs possibles pour `impact` :

```text
low
medium
high
critical
```

## Événements Préchargés

Si la table Supabase est vide pour l'utilisateur courant, le client seed automatiquement des événements initiaux.

Exemples inclus :

- jours fériés France 2026
- Soldes d'hiver
- Saint-Valentin
- Nouvel An chinois
- Ramadan + Aïd el-Fitr
- Fête des Mères / Fête des Pères
- Rentrée / Back to School
- Singles Day 11.11
- Black Friday / Cyber Monday
- Noël + retours post-Noël

Ces événements servent de base de démonstration pour anticiper les impacts commerce, stock, transport et support client.

## Interactions UI

La page Calendrier permet :

- naviguer par mois
- sélectionner un jour
- double-cliquer sur un jour pour préremplir la création d'événement
- créer un événement
- modifier l'événement sélectionné
- supprimer un événement
- déplacer un événement par drag and drop
- afficher les événements multi-jours sur chaque journée concernée
- filtrer visuellement par type d'événement via les couleurs

Chaque action utilisateur persistante écrit immédiatement en base :

- création : `POST`
- édition : `PATCH`
- déplacement drag and drop : `PATCH`
- suppression : `DELETE`

En cas d'erreur API, l'UI affiche une erreur et tente de revenir à l'état précédent pour les actions optimistes.

## Format De Date

Affichage demandé côté UI :

```text
jj-mm-aaaa
```

Les inputs HTML de type date restent techniquement au format navigateur :

```text
yyyy-mm-dd
```

Les dates envoyées à l'API suivent aussi ce format technique, puis l'API les convertit en timestamp Supabase.

## Pourquoi Cette Feature Compte

Le calendrier est pensé comme une couche de contexte pour les futurs agents.

Un agent pourra par exemple :

- lire les événements à venir
- détecter une période à risque logistique
- relier une hausse de pertes à Black Friday ou Noël
- anticiper une rupture fournisseur autour du Nouvel An chinois
- proposer des ajustements de stock ou de transport selon les événements
- créer automatiquement un événement opérationnel

## Points D'Attention

- Ne pas modifier les IDs des événements seed déjà présents en base sans raison.
- Ne pas supprimer `calendar_events` lors d'un `db push`.
- Les événements verrouillés (`locked = true`) sont des événements de référence, mais ils peuvent toujours être lus par les agents.
- La table est partagée dans Supabase : une modification locale via l'UI écrit réellement en base.
- Le calendrier n'utilise plus de dépendance calendrier externe. Il est custom React/CSS afin d'éviter d'imposer une installation de package supplémentaire.

## Vérification Rapide

Depuis `src/` :

```bash
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000/calendar
```

Tester :

1. Double-cliquer sur un jour.
2. Créer un événement.
3. Vérifier qu'il apparaît dans Supabase, table `calendar_events`.
4. Le déplacer par drag and drop.
5. Vérifier que `start_at` et `end_at` changent en base.

