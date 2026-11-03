"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Loader2,
  FlaskConical,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Only ever populated on the server, and only outside production builds. */
export type DevAccount = { role: string; email: string; password: string };

export function LoginForm({ devAccounts }: { devAccounts?: DevAccount[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const pendingNotice = searchParams.get("error") === "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setAuthError(
          result.error === "pending"
            ? "Votre compte partenaire est en attente de validation par l'administrateur."
            : "Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.",
        );
        return;
      }
      const rawCallback = searchParams.get("callbackUrl") || "/";
      const callbackUrl =
        rawCallback.startsWith("/") && !rawCallback.startsWith("//")
          ? rawCallback
          : "/";
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  const hasDevAccounts = Array.isArray(devAccounts) && devAccounts.length > 0;

  return (
    <div className="w-full rounded-lg border border-border bg-card p-8 text-card-foreground shadow-lift">
      {/* Header */}
      <div className="mb-8 space-y-3">
        {/* Brand logo mark */}
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          E
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            E-COM COLAB
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre espace.
          </p>
        </div>
      </div>

      {/* Form body */}
      <div>
        {/* Pending account notice */}
        {pendingNotice && (
          <div
            className="mb-6 flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"
            role="alert"
          >
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <p className="font-semibold">Compte en attente</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Votre compte partenaire est en attente de validation par
                l&apos;administrateur.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Auth error */}
          {authError && (
            <div
              className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{authError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Adresse e-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              placeholder="votre@email.tn"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Mot de passe
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-required="true"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full gap-2 font-semibold"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Connexion…" : "Se connecter"}
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-1">
            Nouveau partenaire ?{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Créer un compte
            </Link>
          </p>
        </form>

        {/* Dev quick-fill panel */}
        {hasDevAccounts && (
          <div className="mt-6 space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Comptes de développement — cliquez pour remplir
            </p>
            <div className="grid gap-1.5">
              {devAccounts!.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword(a.password); setAuthError(null); }}
                  className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="shrink-0 font-medium text-foreground">{a.role}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {a.email} · {a.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
