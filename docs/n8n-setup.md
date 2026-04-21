# Activer le workflow n8n en réel — guide de setup

Le workflow `workflows/calendar-advisor.json` doit être importé dans n8n et branché à l'application Next.js. Voici les 5 étapes.

## Prérequis

- Un compte n8n (recommandé : n8n Cloud free tier → https://app.n8n.cloud)
- L'app Next.js accessible via une **URL publique** (ngrok, Vercel, ou autre)

---

## Étape 1 — Exposer l'app Next.js publiquement

### Option A : ngrok (le plus rapide pour démo locale)

Installer ngrok : https://ngrok.com/download

```bash
# 1. Démarrer l'app Next.js
cd src
npm run dev

# 2. Dans un 2e terminal, exposer le port 3000
ngrok http 3000
```

Copier l'URL `https://XXXX.ngrok-free.app` affichée — c'est `APP_BASE_URL`.

### Option B : Déploiement Vercel

```bash
vercel deploy --prod
```

Copier l'URL de prod affichée — c'est `APP_BASE_URL`.

---

## Étape 2 — Importer le workflow dans n8n

1. Dans n8n Cloud : **Workflows → Import from File**
2. Sélectionner `workflows/calendar-advisor.json`
3. Le workflow apparaît avec 5 nodes : Webhook, IF, POST Advisor, Cron, GET Refresh

---

## Étape 3 — Configurer la variable d'environnement dans n8n

Dans n8n Cloud : **Settings → Environment Variables** (ou settings du workflow)

Ajouter :

```text
APP_BASE_URL = https://XXXX.ngrok-free.app
```

(sans `/` final)

---

## Étape 4 — Activer le workflow et récupérer l'URL du webhook

1. Cliquer sur le node **"Webhook Leave Created"**
2. Copier l'URL du **Production Webhook** (ressemble à `https://xxx.app.n8n.cloud/webhook/calendar-leave-created`)
3. Cliquer sur **Activate** (toggle en haut à droite) pour passer le workflow en production

---

## Étape 5 — Configurer l'URL du webhook dans l'app Next.js

Dans `src/.env` (ou `.env.local`) ajouter :

```text
N8N_WEBHOOK_URL=https://xxx.app.n8n.cloud/webhook/calendar-leave-created
```

Redémarrer le dev server :

```bash
cd src
# Ctrl+C sur le process en cours
npm run dev
```

---

## Test end-to-end

1. Ouvrir `http://localhost:3000/calendar` (ou l'URL ngrok/Vercel)
2. Double-cliquer sur un jour, créer un événement avec **Type = Congés**
3. Observer dans n8n Cloud : **Executions** → une nouvelle exécution doit apparaître avec le node `Is Leave Event` = true → `POST Calendar Advisor` en vert
4. Rafraîchir `/actions` dans le browser → la reco "🏖️ Plan congés …" apparaît

Le flux réel :

```
User crée event kind=leave
   → POST /api/calendar-events (Next.js)
   → INSERT calendar_events
   → fetch(N8N_WEBHOOK_URL, payload)
   → n8n webhook node reçoit
   → n8n IF check kind==leave
   → n8n HTTP POST vers APP_BASE_URL/api/agent/calendar-advisor
   → Next.js calcule + crée AgentRecommendation
   → /actions affiche la reco
```

---

## Cron quotidien

Le node **Cron Daily 07:00** est actif dès que le workflow est en production. Il appelle `GET APP_BASE_URL/api/agent/calendar-advisor/refresh` chaque jour à 7h UTC.

Pour tester manuellement : cliquer sur le node Cron → **Execute Node**.

---

## Troubleshooting

- **Le webhook n'est jamais appelé** : vérifier que `N8N_WEBHOOK_URL` est bien dans `.env` et que le dev server a redémarré après la modif.
- **n8n reçoit le webhook mais l'IF renvoie false** : le payload utilise `$json.body.kind` — si ton n8n est en v0.2x, adapter vers `$json.kind`.
- **POST Calendar Advisor échoue 500** : `APP_BASE_URL` pointe vers localhost côté n8n alors qu'il doit être accessible publiquement. Vérifier l'URL ngrok.
- **ngrok tunnel expire** (free tier rechange l'URL) : il faut remettre à jour `APP_BASE_URL` dans n8n à chaque redémarrage. Alternatif : utiliser Vercel prod.
