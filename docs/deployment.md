# Déploiement — E-COM COLAB

Processus de mise en production. Aucune commande destructible n'est utilisée :
en production on applique **toujours** `prisma migrate deploy`, jamais
`migrate reset`, `db push --force-reset` ni `migrate dev`.

## 1. Vue d'ensemble

```
GitHub (main) → Vercel (build) → PostgreSQL managé
                                  ↘ cron horaire : /api/cron/settle
```

- Le build Vercel exécute `npm run build` = `prisma generate && next build`.
- Les migrations sont appliquées **explicitement** (§6), jamais depuis une
  fonction serverless.

## 2. Base de données de production

1. Créer une base PostgreSQL managée (Neon, Supabase, Railway…).
2. Récupérer deux URLs si le fournisseur le recommande :
   - `DATABASE_URL` — URL **pooled** (utilisée par l'application)
   - `DIRECT_URL` — URL **directe**, requise par `migrate deploy`
3. Activer les sauvegardes automatiques chez le fournisseur **avant** la
   première migration, et vérifier qu'une restauration est possible.

> Ne jamais utiliser la base de développement en production.

## 3. Variables d'environnement Vercel

À ajouter dans **Settings → Environment Variables** (Production) :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | URL PostgreSQL managée (pooled) |
| `DIRECT_URL` | selon fournisseur | URL directe pour les migrations |
| `AUTH_SECRET` | oui | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | oui | origine de production (ex. `https://app.vercel.app`) |
| `AUTH_TRUST_HOST` | oui | `true` |
| `CRON_SECRET` | oui | protège `/api/cron/settle` |
| `TELEGRAM_BOT_TOKEN` | non | ingestion Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | non | authentifie le webhook Telegram |

Les valeurs **ne doivent jamais** être écrites dans le dépôt : uniquement dans
l'interface Vercel. `.env.example` ne contient que des noms, jamais de
secrets.

## 4. Premier déploiement

1. Pousser le code sur `main` (le build part automatiquement).
2. Renseigner les variables d'environnement ci-dessus.
3. Déclencher un redéploiement : **Deployments → … → Redeploy**.

## 5. Appliquer les migrations

Depuis une machine ayant l'accès réseau à la base (et `.env` local pointant
vers la production **temporairement**, ou via variables d'environnement) :

```bash
npx prisma migrate deploy      # applique les migrations en attente
npx prisma migrate status      # doit indiquer "up to date"
node scripts/check-drift.mjs  # vérifie schema.prisma == base
```

`check-drift.mjs` lit `DATABASE_URL` dans `.env` sans jamais l'afficher.

⚠️ Ne jamais exécuter `prisma migrate dev` ni `db push` en production.

## 6. Créer le premier compte administrateur

`npm run db:seed` est **interdit en production** : il crée des comptes de
démonstration à mots de passe connus et il **refuse** de s'exécuter si
`DATABASE_URL` ne pointe pas sur une base locale (ou si `NODE_ENV=production`).

Créer l'administrateur via un script ponctuel, avec un mot de passe fourni par
variable d'environnement :

```bash
ADMIN_EMAIL=… ADMIN_PASSWORD=… npx tsx scripts/create-admin.ts
```

Le mot de passe n'est ni écrit dans le code ni dans Git.

## 7. Premier compte / accès

- Se connecter avec le compte administrateur créé en §6.
- Vérifier `/parametres/system` : base de données, authentification, règlement,
  notifications, limitation de débit, Telegram, Google Drive.

## 8. Cron de règlement

`vercel.json` planifie `/api/cron/settle` **toutes les heures**. Vercel Cron
envoie automatiquement `Authorization: Bearer $CRON_SECRET`, format déjà accepté
par la route. Sans `CRON_SECRET`, l'endpoint répond 500 et ne traite rien.

Le traitement est idempotent : un run répété ne crédite jamais deux fois un gain.

Si Vercel Cron n'est pas disponible (plan), déclencher manuellement :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/settle
```

## 9. Telegram (optionnel)

1. Renseigner `TELEGRAM_BOT_TOKEN` et `TELEGRAM_WEBHOOK_SECRET` (même secret que
   celui donné à Telegram).
2. Pointer le webhook vers la production :

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domaine>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Le webhook est inaccessible sans le secret (401 sinon) et ignore les updates
déjà traités (idempotence). Ne jamais exposer le token.

## 10. Google Drive

Aucune configuration serveur : la plateforme ne stocke que des **liens**
partagés. Un média inaccessible doit être partagé en
« Anyone with the link → Viewer », sinon l'aperçu échoue côté partenaire.

## 11. Vérifications post-déploiement

- [ ] Connexion admin et partenaire
- [ ] Isolation partenaires (A ne voit rien de B)
- [ ] Création d'une commande → `CONFIRMED`
- [ ] `/parametres/system` : tout est « Opérationnel »
- [ ] `GET /api/cron/settle` sans secret → 401
- [ ] Webhook Telegram sans secret → 401

Ne pas créer de commandes de test en production sans validation explicite.

## 12. Sauvegardes

- Activer les sauvegardes automatiques chez le fournisseur PostgreSQL.
- Tester une restauration avant toute migration à risque.
- La stratégie de reprise reste externe à l'application ; aucun secret dans ce
  document.
