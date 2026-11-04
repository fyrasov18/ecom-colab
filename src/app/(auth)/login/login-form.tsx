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
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EcomPartnerLogo } from "@/components/brand/logo";
import { useAuthLanguage } from "@/components/auth/auth-language-context";
import { cn } from "@/lib/utils";

/** Only ever populated on the server, and only outside production builds. */
export type DevAccount = { role: string; email: string; password: string };

export function LoginForm({ devAccounts }: { devAccounts?: DevAccount[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isRtl } = useAuthLanguage();

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
            ? t.login.pendingAlertText
            : t.login.invalidCredentialsError,
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
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "w-full rounded-2xl border border-border bg-card p-6 sm:p-8 text-card-foreground shadow-lift transition-all",
        isRtl ? "text-right" : "text-left"
      )}
    >
      {/* Brand Header */}
      <div className="mb-8 space-y-3">
        <div dir="ltr" className="hidden lg:inline-flex">
          <EcomPartnerLogo variant="horizontal" theme="auto" showTagline={true} />
        </div>
        <div className="pt-0 lg:pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.login.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.login.subtitle}
          </p>
        </div>
      </div>

      {/* Form body */}
      <div>
        {/* Pending account notice */}
        {pendingNotice && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"
            role="alert"
          >
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t.login.pendingAlertTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.login.pendingAlertText}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Auth error */}
          {authError && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{authError}</p>
            </div>
          )}

          {/* Email input */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              {t.login.emailLabel}
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              dir="ltr"
              placeholder={t.login.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAuthError(null);
              }}
              className="text-left font-sans"
            />
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              {t.login.passwordLabel}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-required="true"
                dir="ltr"
                placeholder={t.login.passwordPlaceholder}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError(null);
                }}
                className={cn("text-left font-sans", isRtl ? "pl-10 pr-3" : "pr-10 pl-3")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-0 h-full px-3 text-muted-foreground hover:bg-transparent hover:text-foreground",
                  isRtl ? "left-0" : "right-0"
                )}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full h-11 gap-2 font-semibold text-white shadow-soft transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? t.login.submitting : t.login.submitButton}
            {!loading && (
              isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />
            )}
          </Button>

          {/* Register link */}
          <p className="text-center text-sm text-muted-foreground pt-2">
            {t.login.newPartner}{" "}
            <Link
              href="/register"
              className="font-semibold text-primary underline-offset-4 transition-colors hover:underline hover:text-primary/90"
            >
              {t.login.createAccount}
            </Link>
          </p>
        </form>

        {/* Dev quick-fill panel */}
        {hasDevAccounts && (
          <div className="mt-8 space-y-2 rounded-xl border border-border/80 bg-muted/40 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t.login.devAccountsTitle}</span>
              <span className="text-[11px] opacity-75">· {t.login.devAccountsSubtitle}</span>
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
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
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
