# E-COM COLAB

Plateforme interne d'exploitation du partenariat e-commerce.

**Modèle métier (invariant) :** le Partenaire confirme la commande **avec le client** en amont (réseaux sociaux), puis saisit la commande dans la plateforme — elle est donc **déjà confirmée** (`CONFIRMED`) à sa création. L'Admin/Opérations prend ensuite le relais : validation → préparation → emballage → expédition → livraison (ou refus/retour). Les gains partenaires sont calculés à la livraison, restent **PENDING** pendant la période de settlement configurée, puis deviennent **AVAILABLE**. Tous les soldes dérivent d'un **ledger immuable** (`FinancialTransaction`).

## Stack

- Next.js 15 (App Router) · TypeScript · React 19
- Tailwind CSS v4 · composants style shadcn/ui · lucide-react · sonner
- PostgreSQL 16 (Docker) · Prisma · Decimal(12,3) pour l'argent (TND/DT)
- Auth.js (NextAuth v5) — credentials + bcrypt, sessions JWT
- Zod (validation) · Vitest (tests)

## Démarrage

```bash
docker compose up -d        # PostgreSQL sur le port 5433 (5432 peut être pris par un Postgres local)
npm install
npm approve-scripts prisma @prisma/engines esbuild unrs-resolver && npm rebuild
cp .env.example .env        # puis ajuster AUTH_SECRET en production
npm run db:push             # crée le schéma
npm run db:seed             # données de développement
npm run dev                 # http://localhost:3000
```

> Remarque npm (≥ 11.13) : les scripts d'installation des paquets sont bloqués
> tant qu'ils ne sont pas approuvés (`npm approve-scripts …`). Les paquets
> Prisma (engines) et en ont besoin pour `prisma generate/db push`.

### Comptes de développement (seed — jamais en production)

| Rôle | E-mail | Mot de passe |
|---|---|---|
| SUPER_ADMIN | admin@ecomcolab.tn | Admin123! |
| ADMIN | ops@ecomcolab.tn | Ops12345! |
| PARTNER | nour@partner.tn | Partner123! |

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production (génère Prisma puis compile) |
| `npm run db:push` | synchronise le schéma Prisma vers la BDD |
| `npm run db:seed` | seed de développement (idempotent) |
| `npm test` | tests Vitest (règles métier critiques) |

## Architecture

```
src/
  app/            # routes (groupes: (auth) (admin) (partner))
  components/     # ui/ (primitives) + layout/ (shell)
  lib/            # prisma, auth, rbac, money (decimal), roles
  modules/        # logique métier par domaine (settings, audit, analytics…)
  types/          # extensions de types (next-auth)
prisma/           # schema.prisma + seed.ts
tests/            # Vitest — règles métier critiques
```

Règles : la logique métier vit dans `src/modules/**/service.ts` (jamais dans les composants React) ; toutes les permissions sont validées côté serveur ; les montants utilisent `decimal.js`, jamais de flottants.

## Phases livrées

**Phase 4 — Logistique ✅** : 9 files avec compteurs live
  (À valider, À préparer, En préparation, Prêtes à expédier, Expédiées,
  En livraison, En attente, Retours/Refus, Livrées), filtres recherche +
  partenaire, ordre FIFO pour la préparation.

- **Opérations en lot sûres** : cases à cocher + « Sélectionner tout » +
  un bouton d'avance par file. Chaque commande est **revalidée
  individuellement côté serveur** (transition + rôle + verrou optimiste) avec
  rapport de succès partiel. Le lot est **interdit** pour
  ON_HOLD/REFUSED/RETURNED/CANCELLED (motifs individuels obligatoires) —
  règle testée côté unitaire et serveur.
- **Reprise ON_HOLD** : bouton par ligne → retour à l'étage d'origine.
- **Colis** : `Shipment` créé automatiquement à l'expédition, `deliveredAt`
  à la livraison ; transporteur + n° de suivi éditables sur la fiche
  commande (carte « Livraison / colis », auditée).
- **Refus ≠ Retours** : enregistrement `Return` distinct (kind + motif) à la
  transition — conséquences financières en Phase 5.
- Décision : **pas de restock automatique** au refus/retour (contrôle
  physique requis) — ajustement manuel du stock sur la fiche produit.

## Phase actuelle

**Phase 5 — Finances ✅** : livrée et validée (99 tests : 73 unitaires + 26 intégration, build propre, 31 contrôles HTTP live).
- **Ledger immuable en partie double (`FinancialTransaction`)** :
  - Chaque mouvement financier est une écriture unique et append-only liée au partenaire, à une commande optionnelle, et horodatée.
  - Types : `EARNING` (gain commission), `RETURN_FEE` (coût retour/refus), `WITHDRAWAL` (débit retrait), `ADJUSTMENT` (ajustement manuel admin).
  - Statuts : `PENDING` (gain bloqué durant la période de settlement) → `AVAILABLE` (libéré après settlement) → `REVERSED` (annulé en cas de retour/annulation) | `SETTLED`.
  - Pas d'estimation : le solde disponible et les gains en attente sont calculés à la demande par agrégation SQL (`Wallet` synchronisé de manière déterministe).
- **Settlement & Cron (`/api/cron/settle`)** :
  - `SETTLEMENT_PERIOD_HOURS` configurable (défaut : 48h après `deliveredAt`).
  - La date d'éligibilité (`settlementDueAt`) est gelée à la livraison de la commande.
  - Le cron parcourt les transactions `PENDING` dont `settlementDueAt <= now()`, bascule leur statut vers `AVAILABLE`, et synchronise le `Wallet` du partenaire.
  - Protégé par `CRON_SECRET` dans les en-têtes ou le paramètre `?key=`.
- **Règles de coût de retour (`RETURN_COST_RULE`)** :
  - `RETURN_FEE_ONLY` (défaut) : annule le gain si encore PENDING, et applique les frais de retour contractuels au partenaire si la livraison avait eu lieu.
  - `REVERSE_PLUS_DELIVERY` : annule le gain et facture également le coût de livraison au partenaire.
  - `NO_COST` : annule le gain, la plateforme absorbe intégralement les frais logistiques.
- **Cycle de vie des retraits (`Withdrawal`)** :
  - Statuts : `REQUESTED` → `APPROVED` → `PAID` (ou `REJECTED`).
  - Le montant retirable est strictement basé sur le solde `AVAILABLE` déduit des demandes déjà en cours (`drawable = availableBalance - activeRequests`). Les gains en attente (`PENDING`) ne sont jamais retirables.
  - Minimum de retrait configurable via `MIN_WITHDRAWAL_AMOUNT` (défaut : 100 DT).
  - Débit réel appliqué au `availableBalance` lors du passage à `PAID` avec génération de la transaction `WITHDRAWAL` correspondante.
- **Interfaces & Pages** :
  - `/finance` (Admin) : vue d'ensemble du ledger, filtres par type/statut/partenaire, validation/approbation/rejet/paiement des demandes de retrait, audit complet.
  - `/portefeuille` (Partenaire) : solde disponible, gains en attente détaillés avec dates de libération, historique complet des mouvements, formulaire de demande de retrait avec calcul en temps réel du montant retirable.
  - `/partenaires/[id]` : carte financière dédiée affichant les soldes, le total retiré, le coût cumulé des retours et les derniers mouvements du ledger.

**Phase 6 — Sécurité, Audit & Performances ✅** : build propre, 91 tests unitaires.

- **Moteur d'agrégation pur (`modules/analytics/compute.ts`)** — aucune
  dépendance Prisma ni React, donc les règles sont testables isolément :
  - `percent()` : ratio sûr (jamais de `NaN`/`Infinity` sur un dénominateur vide).
  - `summarizeOrders()` : entonnoir opérationnel (préparation / en livraison /
    livrées / retours). `CANCELLED` et `ON_HOLD` sont **exclus** des
    dénominateurs : leur issue est inconnue, pas négative.
  - `orderAmount()` : montant brut = prix unitaire × quantité, arrondi au
    millime via `decimal.js`.
  - Agrégats produit et plateforme : **seules les commandes `DELIVERED`**
    alimentent le CA, la rémunération et la marge (aligné sur le moteur de
    règlement). Les commandes multi-lignes sont réparties **au prorata** du
    nombre d'unités, donc aucun double comptage.
- **`/audit`** (SUPER_ADMIN) : journal d'audit consultable — recherche,
  filtres par entité et par action, diff JSON avant/après, pagination.
- **`/performances`** (Admin) : taux de livraison/retour globaux, CA livré,
  marge plateforme, classements partenaires et produits.
- **`/tableau-de-bord`** et **`/mes-performances`** (Partenaire) : KPIs réels
  (solde, taux de livraison, taux de retour, CA livré, panier moyen) et
  performance détaillée par produit.
- Décision : **pas de graphique** — aucune librairie de charts n'est
  installée ; les vues utilisent tableaux et cartes KPI.

**Phase 7 — Centre de notifications ✅** : build propre, 116 tests unitaires.

- **Écriture atomique** : `notify()` / `notifyMany()` acceptent le client de
  transaction, donc une notification ne peut jamais atterrir sans
  l'opération métier qui l'a produite (ni l'inverse).
- **Émetteurs branchés sur les flux réels** :
  - changement de statut de commande → partenaire (`ORDER_STATUS`), avec un
    libellé expliquant la conséquence financière ;
  - demande de retrait → back office ; approbation / rejet / paiement →
    partenaire (`WITHDRAWAL`) ;
  - règlement des gains (cron ou manuel) → partenaire (`SETTLEMENT`),
    **groupé par partenaire** (5 gains libérés = 1 notification) ;
  - gain annulé par une règle de coût de retour → partenaire (`EARNING`),
    avec le montant repris et les frais éventuels ;
  - stock bas → back office (`STOCK`), **uniquement au franchissement** du
    seuil : un produit à 2 unités sous un seuil de 5 alerte une fois (6 → 2),
    puis se tait jusqu'au réapprovisionnement.
- **Isolation** : le `userId` est toujours appliqué dans le `WHERE` — un
  utilisateur ne peut ni lire ni marquer comme lu la notification d'un autre.
- **Interfaces** : `/notifications` (Admin) et `/mes-notifications`
  (Partenaire) — feed groupé par jour, filtres toutes / non lues / lues et par
  type, marquage individuel ou global, lien direct vers l'écran concerné.
- Pastille de non-lus dans l'en-tête (plafonnée à `99+`).
- **Aucun script de seed dédié n'est nécessaire** : `npm run db:orders-seed`
  passe déjà par `createOrder` / `changeOrderStatus`, donc il produit un
  historique de notifications authentique (audit trail inclus) au lieu de
  lignes insérées à la main.

**Phase 8 — Durcissement & tests d'intégration** : en cours.

- **Atomicité des notifications prouvée** (`tests/integration/notifications.int.test.ts`,
  18 tests) — c'était jusqu'ici une affirmation, pas une garantie vérifiée :
  - une notification écrite via le client de transaction **est annulée** si
    l'opération métier échoue (et survit si elle est écrite hors transaction,
    ce qui explique pourquoi le client `tx` est passé partout) ;
  - une transition refusée ne laisse **ni notification, ni ligne d'historique,
    ni trace d'audit** derrière elle ;
  - chaque audience est vérifiée : un changement de statut ne notifie
    que le partenaire concerné (ni l'opérateur, ni un autre partenaire) ;
  - un gain annulé par un retour produit bien **deux** notifications
    distinctes (statut + impact financier) ;
  - la règle anti-saturation du stock est validée en base : alerte au
    franchissement du seuil, silence ensuite.
- **Isolation en lecture** : `markAsRead` / `markAllAsRead` vérifiés contre la
  tentative de marquer la notification d'un autre, et la pagination vérifiée
  bornée au slice de l'appelant (avec un test sur le clamp 5..50).


## Tests

```bash
npm test                # unitaires (116 tests Vitest)
npm run test:int        # intégration DB réelle (44 tests Vitest)
npm run db:finance-seed # jeu d'essai financier (transactions, retraits, portefeuilles)
# smoke HTTP (serveur lancé) :
npx tsx scripts/pick-ids.ts
powershell -ExecutionPolicy Bypass -File .\smoke-test.ps1
```
