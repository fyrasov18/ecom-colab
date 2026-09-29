"use server";

import { requireSession } from "@/lib/rbac";
import { listAuthorizedUsers } from "@/modules/telegram/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { authorizeUserAction, revokeUserAction } from "./system-actions";

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export async function TelegramSettings() {
  // Managing who may import products is a security decision → SUPER_ADMIN.
  // requireSession() throws when the caller lacks the role, so the result is
  // not needed here.
  await requireSession(["SUPER_ADMIN"]);
  const users = await listAuthorizedUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Intégration Telegram</CardTitle>
        <CardDescription>
          Seuls les comptes Telegram listés ici peuvent créer des brouillons de
          produits. L&apos;autorisation repose sur l&apos;identifiant Telegram
          stable, jamais sur un nom d&apos;utilisateur.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Configuration requise</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Renseigner TELEGRAM_BOT_TOKEN et TELEGRAM_WEBHOOK_SECRET.</li>
            <li>
              Pointer le webhook Telegram sur{" "}
              <code className="font-mono">/api/telegram/webhook</code> avec le même
              secret.
            </li>
            <li>
              Ajouter ci-dessous l&apos;identifiant Telegram (chiffre) de chaque
              administrateur.
            </li>
          </ol>
          <p className="mt-2">
            Les jetons ne sont jamais stockés en base ni exposés au navigateur.
          </p>
        </div>

        {users.length === 0 ? (
          <EmptyState
            title="Aucun compte Telegram autorisé"
            description="Ajoutez un identifiant pour activer l'ingestion de produits."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {u.displayName ?? `Utilisateur ${u.telegramUserId}`}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    ID {u.telegramUserId} · autorisé le{" "}
                    {u.authorizedAt.toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.status === "ACTIVE" ? "success" : "secondary"}>
                    {u.status === "ACTIVE" ? "Autorisé" : "Révoqué"}
                  </Badge>
                  {u.status === "ACTIVE" ? (
                    <form action={revokeUserAction}>
                      <input type="hidden" name="telegramUserId" value={u.telegramUserId} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        confirmMessage={`Révoquer l'accès Telegram de ${u.displayName ?? u.telegramUserId} ?`}
                      >
                        Révoquer
                      </ConfirmSubmit>
                    </form>
                  ) : (
                    <form action={authorizeUserAction}>
                      <input type="hidden" name="telegramUserId" value={u.telegramUserId} />
                      <input type="hidden" name="displayName" value={u.displayName ?? ""} />
                      <Button type="submit" variant="outline" size="sm">
                        Réautoriser
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={authorizeUserAction} className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="tg-id">
                Identifiant Telegram
              </label>
              <input
                id="tg-id"
                name="telegramUserId"
                required
                inputMode="numeric"
                pattern="-?\d{1,20}"
                placeholder="123456789"
                className={fieldClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="tg-name">
                Nom (optionnel)
              </label>
              <input
                id="tg-name"
                name="displayName"
                maxLength={80}
                className={fieldClass}
              />
            </div>
          </div>
          <Button type="submit" size="sm">
            Autoriser ce compte
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
