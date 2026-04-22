# Hackathon Mirakl

Application Next.js 14 utilisée pour prototyper un cockpit opérationnel autour des flux marketplace, stock, entrepôt, transport, calendrier métier et suivi des pertes.

Le projet est actuellement branché sur une base Supabase partagée. Les données métier de départ viennent du dossier `docs/data`.

## État Fonctionnel

Modules visibles dans le menu :

- `Dashboard` : vue d'accueil des modules disponibles.
- `Paramètres` : profil et configuration.
- `Stock` : catalogue produits et mouvements de stock.
- `Entrepôt` : zones, bacs, contenu de bacs et picking.
- `Transport` : suivi colis et transporteurs.
- `Calendrier` : événements métiers, jours fériés, temps forts commerce, congés.
- `Suivi des pertes` : analyse V1 des pertes de stock par étape, cause, produit, commande et transporteur.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- Supabase Postgres
- Zod pour les validations API

Le code applicatif est dans `src/`.

## Installation

Depuis la racine du repo :

```bash
cd src
npm install
```

Puis lancer le dashboard :

```bash
npm run dev
```

Application locale :

```text
http://localhost:3000
```

Pages utiles :

```text
http://localhost:3000/dashboard
http://localhost:3000/calendar
http://localhost:3000/losses
```

## Variables D'Environnement

Créer `src/.env` ou `src/.env.local` à partir de `src/.env.example`.

Variables attendues :

```bash
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-...pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
HACKATHON_USER_ID="<uuid utilisateur>"
```

Notes :

- `DATABASE_URL` pointe vers Supabase via le pooler.
- `DIRECT_URL` pointe vers la connexion directe Supabase.
- `HACKATHON_USER_ID` force l'utilisateur utilisé par les pages serveur et APIs.
- Les fichiers `.env` et `.env.local` ne doivent pas être commit.

## Commandes Utiles

Depuis `src/` :

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
```

Attention :

```bash
npm run db:push
```

Cette commande lance actuellement `prisma db push --accept-data-loss`. Ne pas l'utiliser sans vérifier le diff Prisma, car certaines tables de données ont été créées manuellement dans Supabase et ne sont pas toutes représentées dans `schema.prisma`. Un `db push` non relu peut proposer de supprimer des tables utiles.

Pour ce projet, privilégier :

```bash
npm run prisma:generate
```

Et, si une table doit être créée ponctuellement, utiliser un script SQL ciblé via :

```bash
npx prisma db execute --schema prisma/schema.prisma --file chemin/du/script.sql
```

## Base Supabase

Schéma principal :

```text
public
```

Tables applicatives principales :

- `products`
- `product_categories`
- `stock_movements`
- `parcels`
- `warehouse_zones`
- `warehouse_bins`
- `bin_contents`
- `picking_lists`
- `picking_tasks`
- `calendar_events`
- `loss_events`

Tables de données importées depuis `docs/data` :

- `data_orders_amazon`
- `data_orders_google`
- `data_messages_amazon`
- `data_messages_google`
- `data_supplier_catalog_nordika_200`

Ces tables importées servent de base réaliste pour les modules d'analyse.

## Données Importées

Le dossier source contient :

```text
docs/data/messages_amazon.jsonl
docs/data/messages_google.jsonl
docs/data/orders_amazon.jsonl
docs/data/orders_google.jsonl
docs/data/supplier_catalog_nordika_200.xlsx
```

État d'import connu :

- `data_orders_amazon` : 496 lignes
- `data_orders_google` : 257 lignes
- `data_messages_amazon` : 160 lignes
- `data_messages_google` : 91 lignes
- `data_supplier_catalog_nordika_200` : 200 lignes

## Calendrier

Route :

```text
/calendar
```

Table Supabase :

```text
public.calendar_events
```

Le calendrier permet :

- affichage mensuel
- événements multi-jours
- drag and drop pour déplacer un événement
- double-clic sur un jour pour préremplir la création
- création, édition et suppression d'événements
- sauvegarde immédiate dans Supabase

Colonnes clés :

- `title`
- `start_at` en `timestamptz`
- `end_at` en `timestamptz`
- `kind`
- `impact`
- `zone`
- `notes`
- `locked`
- `created_at`
- `updated_at`

Les événements préchargés incluent des jours fériés français et des temps forts commerce comme :

- Nouvel An chinois
- Ramadan / Aïd el-Fitr
- Soldes
- Singles Day
- Black Friday / Cyber Monday
- Noël et période de retours

## Suivi Des Pertes

Route :

```text
/losses
```

Table Supabase :

```text
public.loss_events
```

Objectif V1 :

- répondre à "où les pertes apparaissent ?"
- répondre à "pourquoi elles arrivent ?"
- répondre à "qui / quoi est concerné ?"
- donner une vision rapide de la valeur perdue, des unités perdues, des pertes à traiter, de l'étape critique, de la cause principale et du transporteur le plus concerné

La V1 est volontairement en lecture seule. Elle affiche :

- KPI cliquables
- détail de KPI
- camemberts interactifs au survol
- filtres par recherche, étape, raison, transporteur, marketplace, statut
- tableau des pertes
- panneau détail d'une perte sélectionnée

Les données `loss_events` ont été générées à partir des vraies tables importées :

- `data_orders_amazon`
- `data_orders_google`
- `data_supplier_catalog_nordika_200`

Champs importants :

- `source_table`
- `source_line`
- `source_order_ref`
- `sku`
- `product_name`
- `category`
- `quantity_lost`
- `unit_cost`
- `order_unit_price`
- `estimated_loss_value`
- `detected_stage`
- `reason_category`
- `confidence`
- `status`
- `carrier_name`
- `marketplace`
- `supplier_name`

État connu du seed V1 :

- 20 événements de perte
- 30 unités perdues
- 17 474 EUR de valeur estimée
- 20 SKU distincts
- 18 commandes distinctes

## Conventions De Développement

Les pages App Router sont dans :

```text
src/app
```

Les composants globaux sont dans :

```text
src/components
```

Les helpers DB/session sont dans :

```text
src/lib
```

Le schéma Prisma est dans :

```text
src/prisma/schema.prisma
```

Quand une feature doit être disponible dans le menu, ajouter l'entrée dans :

```text
src/components/Sidebar.tsx
```

Et ajouter une tuile module dans :

```text
src/app/dashboard/page.tsx
```

## Workflow Recommandé Pour Pull

```bash
git switch dev
git pull origin dev
cd src
npm install
npm run dev
```

Si Prisma se plaint d'un client non généré :

```bash
npm run prisma:generate
```

Si Next affiche une erreur étrange après un build ou un changement de branche :

```bash
pkill -f "next dev"
rm -rf .next
npm run dev
```

## Points D'Attention

- Ne pas commit les fichiers `.env`.
- Ne pas utiliser `npm run db:push` sans relire le risque de suppression de tables.
- Certaines tables Supabase ont été créées/importées manuellement pour le hackathon.
- `products`, `parcels`, `warehouse_zones` et `warehouse_bins` peuvent être vides selon l'état de la démo.
- `loss_events` s'appuie aujourd'hui sur les tables importées `data_*`, pas encore sur des écritures temps réel du module Stock.
- Le module `Suivi des pertes` est une V1 d'analyse, pas encore un CRUD.

## Build

Commande validée :

```bash
cd src
npm run build
```

Warnings connus non bloquants :

- dépendances `useEffect` dans `app/parcels/ParcelsPageClient.tsx`
- usage de `<img>` dans `app/stock/StockPageClient.tsx`

Ces warnings existaient avant la feature `Suivi des pertes`.
