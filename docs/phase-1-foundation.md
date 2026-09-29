# Phase 1 — Socle (architecture, base de données, auth, RBAC, paramètres)

Ce document décrit le socle sur lequel reposent les phases fonctionnelles
(commandes, finances, analytics…). Il ne couvre volontairement **aucune** de ces
fonctionnalités : la Phase 1 s'arrête aux fondations et aux garanties vérifiables.

## 1. Architecture

```
src/
  app/            # routes Next.js (App Router) — groupes (auth) (admin) (partner)
  components/     # ui/ (primitives) + layout/ (sidebar, header, nav)
  lib/            # prisma, auth, auth-config, rbac, roles, money
  modules/        # logique métier par domaine — SEUL endroit qui parle à la base
  types/          # augmentation des types next-auth
prisma/           # schema.prisma + migrations/** + seed.ts
tests/            # Vitest (unitaires) · tests/integration/** (base réelle)
```

Règle de dépendance (appliquée, pas seulement documentée) :

1. `src/app/**` et `src/components/**` **n'importe pas** `@/lib/prisma` ;
   ESLint le refuse (`no-restricted-imports` dans `eslint.config.mjs`).
2. `src/app/**` compose : `requireSession()` (garde) → `modules/**/queries|service`
   (données) → composant d'affichage.
3. `src/modules/**` contient la logique ; les lectures pures vivent dans
   `queries.ts`, les écritures transactionnelles dans `service.ts`, les règles
   pures dans des fichiers sans dépendance (ex. `*schemas.ts`, `compute.ts`),
   ce qui les rend testables sans base.

## 2. Base de données

- PostgreSQL 16 (Docker, port 5433) + Prisma 6 ; argent en `Decimal(12,3)`
  (jamais de flottant, calculs via `decimal.js`).
- **Migrations Prisma** : `prisma/migrations/**` est la source de vérité.
  - `20260926120000_init/migration.sql` = baseline (schéma complet, généré puis
    vérifié contre `schema.prisma`).
  - `npm run db:migrate` (dev) · `npm run db:migrate:deploy` (CI/prod) ·
    `npm run db:migrate:status`.
  - `npm run db:push` reste un raccourci de prototypage, hors flux nominal.
- Vérification : la CI applique les migrations sur une base **vierge** puis
  échoue si `schema.prisma` et les migrations divergent
  (`prisma migrate diff --from-url … --to-schema-datamodel … --exit-code`).
- Séquence `order_number_seq` : créée à l'exécution par le module orders
  (`CREATE SEQUENCE IF NOT EXISTS`), donc volontairement hors migrations —
  Prisma la supprimerait sinon comme objet non géré.

## 3. Authentification

- Auth.js (NextAuth v5) + `Credentials` + bcrypt (12 tours) ; comptes
  `DISABLED` refusés ; e-mail normalisé en minuscules.
- `src/lib/auth-config.ts` = config **edge-safe** (aucun import Prisma/bcrypt),
  partagée par `middleware.ts` et le runtime serveur :
  - stratégie JWT, `maxAge` 12 h, `updateAge` 1 h ;
  - `pages.signIn = "/login"` ;
  - mapping des claims `user ⇄ token ⇄ session`
    (`id`, `role`, `partnerId`, `firstName`, `lastName`).
- Le cookie est géré par Auth.js (`httpOnly`, `SameSite=Lax`, `Secure` en
  HTTPS) : aucune surcouche maison, donc aucun risque de désynchronisation avec
  les préfixes `__Secure-` calculés par la librairie.
- **Événements audités** : `LOGIN_SUCCEEDED`, `LOGIN_FAILED`
  (`UNKNOWN_EMAIL`, `USER_DISABLED`, `INVALID_PASSWORD`) avec IP + user-agent.
  L'écriture est *best effort* (`try/catch`) : elle ne peut pas casser une
  connexion valide.
- Tests unitaires : `tests/auth-config.test.ts` (durée de session, absence de
  providers côté edge, mapping des claims dans les deux sens).


## 4. RBAC

Trois rôles (`Role`) : `SUPER_ADMIN`, `ADMIN`, `PARTNER`.

| Zone | Préfixes | SUPER_ADMIN | ADMIN | PARTNER |
|---|---|---|---|---|
| Back-office | `/dashboard`, `/commandes`, `/produits`, `/partenaires`, `/clients`, `/logistique`, `/finance`, `/performances`, `/marketing`, `/notifications`, `/parametres`, `/audit` | ✅ | ✅ | ❌ → `/tableau-de-bord` |
| Espace partenaire | `/tableau-de-bord`, `/catalogue`, `/nouvelle-commande`, `/mes-commandes`, `/mes-performances`, `/portefeuille`, `/mes-notifications` | ❌ → `/dashboard` | ❌ → `/dashboard` | ✅ |
| Public | `/login`, `/api/auth/*`, `/api/cron/*` (secret partagé) | — | — | — |

- `src/lib/roles.ts` : helpers **purs** (`ROLE_HOME`, `matchPrefix`,
  `ADMIN_PREFIXES`, `PARTNER_PREFIXES`) — testés unitairement et utilisables
  dans le middleware (edge).
- `src/middleware.ts` : non authentifié → `/login?callbackUrl=…` ; `/login`
  pour un utilisateur connecté → page d'accueil de son rôle ; `/` → `ROLE_HOME`.
- `src/lib/rbac.ts` : `requireSession(roles?)` dans chaque layout et chaque
  server action (défense côté serveur, jamais côté client seulement).
- Isolation partenaire : les requêtes filtrent sur le `partnerId` **de la
  session** ; aucun identifiant d'appartenance n'est lu depuis l'URL.
- `/parametres` et `/audit` : écriture/lecture réservées au `SUPER_ADMIN`
  (les autres rôles reçoivent une redirection côté serveur).

## 5. Layout, sidebar, header, routing

- `src/app/(admin)/layout.tsx` : `requireSession(["SUPER_ADMIN","ADMIN"])`,
  sidebar (12 entrées) + header avec identité, rôle et badge de notifications
  non lues (`countUnread`).
- `src/app/(partner)/layout.tsx` : `requireSession(["PARTNER"])`, sidebar +
  barre mobile + header.
- `src/app/(auth)/login` : page publique ; un utilisateur déjà connecté est
  renvoyé vers l'accueil de son rôle.
- Racine `src/app/page.tsx` : redirection selon le rôle.

## 6. Paramètres système

`src/modules/settings/` :

- `defaults.ts` — `SETTING_KEYS`, `SETTING_DEFAULTS`, catégories, descriptions ;
- `schemas.ts` — validation Zod de **chaque** clé (sans import Prisma, donc
  testable sans base) ;
- `service.ts` — `getSetting`, accesseurs typés (`getSettlementPeriodHours`,
  `getGlobalCommission`…), `updateSetting` (validation + audit
  `SETTING_UPDATED` dans la même transaction), `listFinanceSettings`.

| Clé | Défaut | Bornes |
|---|---|---|
| `finance.settlement_period_hours` | 48 | entier 1–720 (30 j) |
| `finance.min_withdrawal_amount` | 100 | > 0, ≤ 1 000 000 |
| `finance.return_cost_rule` | `REVERSE_PENDING_EARNING` | 3 valeurs documentées |
| `finance.global_commission` | 60 % | `{ type, value }` ; % ≤ 100, fixe > 0 |

`/parametres` : lecture ADMIN, écriture **SUPER_ADMIN** uniquement (champs
désactivés sinon). La période de settlement est donc configurable par
l'administrateur, et une valeur invalide est refusée côté serveur avec un
message de champ lisible (jamais une trace Zod brute).

## 7. Portes de qualité

| Porte | Commande | Où |
|---|---|---|
| Types | `npx tsc --noEmit` | local + CI `quality` |
| Lint | `npm run lint` (ESLint 9, config flat) | local + CI `quality` |
| Tests unitaires | `npm test` | local + CI `quality` |
| Build | `npm run build` | CI `quality` |
| Migrations | `npx prisma migrate deploy` sur base vierge | CI `integration` |
| Dérive de schéma | `prisma migrate diff --exit-code` | CI `integration` |
| Intégration | `npm run test:int` (PostgreSQL réel) | CI `integration` |
| Auth/RBAC de bout en bout | `node scripts/verify-auth.mjs` | local (le script démarre son propre serveur) |

## 8. Hors périmètre (assumé)

Les modules Commandes, Finance, Analytics, Marketing et Notifications
**existants** n'ont pas été modifiés fonctionnellement par cette phase : seules
des corrections de stabilité sans impact métier y ont été apportées
(tie-breakers de pagination, violations de règles React 19, imports inutilisés).
Restent ouverts pour les phases suivantes : réinitialisation de mot de passe et
gestion des utilisateurs dans l'interface, sessions révocables côté serveur,
envoi d'e-mails (outbox), worker de settlement, statut `LOST`, retours partiels,
commandes multi-lignes.

