"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Loader2,
  LockKeyhole,
  FlaskConical,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card className="w-full max-w-md border-border/70 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl tracking-tight">E-COM COLAB</CardTitle>
        <CardDescription>
          Connectez-vous pour accéder à votre espace.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Pending account notice — shown when redirected from middleware */}
        {pendingNotice && (
          <div
            className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
            role="alert"
          >
            <Clock
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Compte en attente</p>
              <p className="mt-0.5">
                Votre compte partenaire est en attente de validation par
                l&apos;administrateur.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {/* Auth error */}
          {authError && (
            <div
              className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <p>{authError}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              placeholder="votre@email.tn"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAuthError(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-required="true"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError(null);
                }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            aria-busy={loading}
          >
            {loading && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {loading ? "Connexion…" : "Se connecter"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Nouveau partenaire ?{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 hover:underline transition-colors"
            >
              Créer un compte
            </Link>
          </p>
        </form>

        {/* Dev quick-fill panel (non-production only) */}
        {hasDevAccounts && (
          <div className="mt-6 space-y-2 rounded-lg border border-dashed bg-muted/40 p-3 transition-colors hover:bg-muted/60">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Comptes de développement — cliquez pour remplir
            </p>
            <div className="grid gap-1.5">
              {devAccounts!.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                    setAuthError(null);
                  }}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                >
                  <span className="shrink-0 font-medium">{a.role}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {a.email} · {a.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
