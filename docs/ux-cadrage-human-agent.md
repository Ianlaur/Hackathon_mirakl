# Note de cadrage UX — Interaction Humain / Agent

**Projet** : Supply Pilot AI (MIRAKL CONNECT)
**Date** : Avril 2026
**Objectif** : Décrire les choix d'interaction entre l'utilisateur final et les agents IA du produit — ce qui est visible, interruptible et configurable.

---

## Philosophie

Le produit suit un principe fondamental : **l'IA propose, l'humain dispose**. Aucune action autonome n'est exécutée sans validation explicite de l'utilisateur. L'IA agit comme un copilote nommé **Leia** — elle analyse, recommande et explique, mais le marchand garde le contrôle final sur toutes les décisions opérationnelles.

---

## 1. Ce qui est visible

### Recommandations contextuelles
Chaque recommandation IA est affichée dans un **centre d'actions dédié** (page Actions) avec :
- un **résumé du raisonnement** expliquant pourquoi l'IA recommande cette action
- une **note de confiance** (niveau de certitude de l'agent)
- l'**impact attendu** si l'utilisateur approuve (ex : "évite une rupture sur 3 SKUs, coût estimé 1 240 €")
- les **données sources** : période analysée, SKUs à risque, vélocité de vente, délais fournisseurs

### Exécution des outils
Lorsque Leia exécute un outil (création d'événement calendrier, plan de réapprovisionnement, brouillon d'email), l'action est **affichée en temps réel** dans le chat sous forme de chip visible (ex : "Création événement calendrier"), avec le résultat affiché en ligne dans la conversation.

### Alertes proactives
Sur le Dashboard et les pages métier (Losses, Stock, Orders), des **cartes de décision** signalent les situations critiques avec un code couleur sémantique :
- Rouge (#F22E75) : risque urgent, action requise
- Bleu (#2764FF) : insight Leia, opportunité
- Jaune (#E0A93A) : avertissement, à surveiller

---

## 2. Ce qui est interruptible

### Approbation par recommandation
Chaque recommandation suit un workflow explicite :
- **"À valider"** → l'utilisateur examine les détails
- **"Approuvée"** → exécution déclenchée uniquement après validation
- **"Rejetée"** → avec commentaire optionnel pour améliorer les futures recommandations

### Sélection granulaire
L'utilisateur ne valide pas en bloc : il peut **sélectionner individuellement les SKUs ou lignes** d'un plan de réapprovisionnement, ajuster les quantités, et ne valider qu'un sous-ensemble. Le coût et le nombre d'articles se mettent à jour dynamiquement.

### Conversation naturelle
Via le chat Leia (barre de recherche sur le Dashboard ou tiroir latéral), l'utilisateur peut :
- demander des précisions avant de valider
- modifier une recommandation par le langage naturel
- annuler ou ajuster une action proposée

### Actions réversibles
Les boutons de décision sont toujours présentés par paires :
- **Action principale** (ex : "Approve Restock", "Apply Price Change")
- **Alternative** (ex : "Ignore", "Snooze Alert", "Review Details")

---

## 3. Ce qui est configurable

### Mode d'autonomie
Le système dispose d'un paramètre `autonomy_mode` avec un défaut strict : **`approval_required`** — aucune exécution automatique. Ce paramètre est stocké par marchand et peut évoluer vers des modes plus autonomes (ex : auto-exécution sous un seuil de coût) tout en gardant la traçabilité.

### Préférences modèle
Le marchand peut choisir le modèle IA utilisé (`preferred_model`) pour ajuster le rapport qualité/coût des recommandations.

### Activation des fonctionnalités
Via la page Settings, l'utilisateur active ou désactive :
- les fonctionnalités beta
- les modules métier (inventaire, entrepôt)
- les intégrations marketplace (Shopify, etc.)

### Calendrier comme levier de contrôle
L'utilisateur influence directement les décisions IA en enrichissant le calendrier opérationnel : congés, jours fériés, temps forts commerce. L'agent Calendar Advisor s'appuie sur ces événements pour anticiper les besoins de réapprovisionnement — l'humain contrôle les inputs, l'IA adapte ses outputs.

---

## Synthèse

| Dimension | Approche |
|-----------|----------|
| **Visibilité** | Tout raisonnement IA est affiché avec données sources, confiance et impact |
| **Interruptibilité** | Validation explicite requise, sélection granulaire, rejet avec feedback |
| **Configurabilité** | Mode autonomie, choix du modèle, activation de modules, calendrier opérationnel |
| **Principe directeur** | L'IA ne fait rien sans l'accord de l'humain — elle éclaire, l'humain décide |
