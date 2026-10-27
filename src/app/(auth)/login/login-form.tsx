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
    <div className="glass-card w-full rounded-2xl p-8 text-white">
      {/* Header */}
      <div className="mb-8 space-y-3">
        {/* Brand logo mark */}
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
            boxShadow: "0 4px 16px rgba(37,99,235,0.45)",
          }}
        >
          E
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            E-COM COLAB
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Connectez-vous pour accéder à votre espace.
          </p>
        </div>
      </div>


      {/* Form body */}
      <div>
        {/* Pending account notice */}
        {pendingNotice && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300"
            role="alert"
          >
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <div>
              <p className="font-semibold">Compte en attente</p>
              <p className="mt-0.5 text-amber-300/80">
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
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{authError}</p>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white/80"
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
              className="border-white/15 bg-white/08 text-white placeholder:text-white/35 focus:border-brand-500 focus:ring-brand-500/20"
              style={{ background: "rgba(255,255,255,0.07)" }}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white/80"
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
                className="border-white/15 pr-10 text-white placeholder:text-white/35 focus:border-brand-500"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 text-white/40 hover:bg-transparent hover:text-white/80"
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

          {/* Submit — gradient brand button */}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
              boxShadow: "0 4px 20px rgba(37,99,235,0.40)",
            }}
          >
            {/* Shine sweep on hover */}
            <span
              className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-[100%]"
              aria-hidden="true"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <p className="text-center text-sm text-white/50">
            Nouveau partenaire ?{" "}
            <Link
              href="/register"
              className="font-medium text-blue-400 underline-offset-4 transition-colors hover:text-blue-300 hover:underline"
            >
              Créer un compte
            </Link>
          </p>
        </form>

        {/* Dev quick-fill panel */}
        {hasDevAccounts && (
          <div className="mt-6 space-y-2 rounded-xl border border-white/10 bg-white/05 p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/40">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Comptes de développement — cliquez pour remplir
            </p>
            <div className="grid gap-1.5">
              {devAccounts!.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword(a.password); setAuthError(null); }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-white/20 hover:bg-white/05"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="shrink-0 font-medium text-white/70">{a.role}</span>
                  <span className="truncate font-mono text-[11px] text-white/35">
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

