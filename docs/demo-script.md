# Script démo Loom — Calendar-Aware Restock Advisor

**Durée cible** : 90 secondes sur les 5-8 min du Loom complet.

## Préparation (avant Loom)

1. Exécuter depuis `src/` :

   ```bash
   npx ts-node --compiler-options "{\"module\":\"CommonJS\",\"target\":\"es2017\"}" scripts/seed-demo-scenario.ts
   ```

   Reset stock à critique sur 5 SKUs + crée l'event "Congés Savoie - Démo" + affiche l'UUID.

2. Ouvrir `http://localhost:3000/calendar` dans un onglet.
3. Ouvrir `http://localhost:3000/actions` dans un second onglet.
4. Noter l'UUID de l'event pour le curl de secours.

## Déroulé

| t (s) | Écran | Action | Voiceover |
|---|---|---|---|
| 00:00 | /calendar | Zoom sur les dates dans ~10 jours | "Jean-Charles veut partir 10 jours en Savoie." |
| 00:10 | /calendar | Double-clic sur un jour, saisir "Congés Savoie", kind=leave | "Il crée l'événement dans son calendrier." |
| 00:20 | sidebar | Cliquer sur Actions (badge compteur = 1) | "L'agent a détecté l'absence et préparé un plan." |
| 00:25 | /actions | Reco "Plan congés" sélectionnée | "Un seul plan, pas 5 alertes séparées." |
| 00:35 | /actions | Lire le tableau SKU, pointer la colonne Projection négative | "Voilà les 5 références qui vont tomber en rupture." |
| 00:55 | /actions | Décocher 1 ligne | "Celle-là, je la gère avec un autre fournisseur." |
| 01:05 | /actions | Clic "Approuver la sélection" | "Un clic — 4 commandes passées." |
| 01:15 | Confirmation | Statut passe à "Approuvée" | "Jean-Charles peut partir. Le business continue sans lui." |

## Plan B si n8n ne répond pas

Déclencher la reco manuellement :

```bash
curl -X POST "http://localhost:3000/api/agent/calendar-advisor/trigger?event_id=<UUID>"
```

Puis rafraîchir `/actions`.

## Reset rapide entre deux prises

```bash
# Supprimer la reco pending pour rejouer
npx prisma studio
# Table agent_recommendations : delete row calendar_restock_plan pending_approval
```
