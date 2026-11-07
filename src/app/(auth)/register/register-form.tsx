"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { DynamicBrandLogo } from "@/components/brand/dynamic-brand-logo";
import { useAuthLanguage } from "@/components/auth/auth-language-context";
import { registerAction, type RegisterState } from "./actions";
import type { AuthPagesDesign } from "@/modules/branding/defaults";
import { cn } from "@/lib/utils";

const initialState: RegisterState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive mt-1 font-medium" role="alert">
      {message}
    </p>
  );
}

interface RegisterFormProps {
  authDesign?: AuthPagesDesign | null;
}

export function RegisterForm({ authDesign }: RegisterFormProps) {
  const searchParams = useSearchParams();
  const refCode = (searchParams.get("ref") || searchParams.get("code") || "").trim();
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const { t, isRtl } = useAuthLanguage();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const buttonBg = authDesign?.colors?.buttonBg || "#10B981";
  const buttonText = authDesign?.colors?.buttonText || "#FFFFFF";
  const lightLogoUrl = authDesign?.branding?.logoLightUrl || null;

  /* ── Success state ──────────────────────────────────────────────────── */
  if (state.ok) {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className={cn(
          "w-full rounded-2xl border border-border bg-card p-6 sm:p-8 text-card-foreground shadow-lift space-y-6 transition-all",
          isRtl ? "text-right" : "text-left"
        )}
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {t.register.successTitle}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {state.message ?? t.register.successPendingText}
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 text-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-foreground">
              {t.register.successPendingTitle}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t.register.successPendingText}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/40 p-4 text-xs space-y-2">
          <p className="font-semibold text-foreground">
            {t.register.successPendingTitle}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t.register.successPendingText}
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {t.register.backToLogin}
        </Link>
      </div>
    );
  }

  /* ── Form state ─────────────────────────────────────────────────────── */
  const fe = state.fieldErrors ?? {};

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "w-full rounded-2xl border border-border bg-card p-6 sm:p-8 text-card-foreground shadow-lift transition-all",
        isRtl ? "text-right" : "text-left"
      )}
    >
      {/* Brand Header */}
      <div className="mb-6 space-y-3">
        <div dir="ltr" className="hidden lg:inline-flex">
          <DynamicBrandLogo
            variant="horizontal"
            theme="auto"
            showTagline={true}
            customLogoUrl={lightLogoUrl}
          />
        </div>
        <div className="pt-0 lg:pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.register.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.register.subtitle}
          </p>
        </div>
      </div>

      {/* Approval notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-foreground">
            {t.register.approvalNoticeTitle} :
          </strong>{" "}
          {t.register.approvalNoticeText}
        </p>
      </div>

      <form action={formAction} className="space-y-6" noValidate>
        {/* ── Personal information ─────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="w-full border-b border-border pb-1.5 text-sm font-semibold text-foreground">
            {t.register.personalInfoLegend}
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">
              {t.register.fullNameLabel}{" "}
              <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <div className="relative">
              <div
                className={cn(
                  "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
                  isRtl ? "right-3" : "left-3"
                )}
              >
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                aria-required="true"
                aria-invalid={!!fe.fullName}
                dir="auto"
                placeholder={t.register.fullNamePlaceholder}
                className={cn("transition-all", isRtl ? "pr-9 pl-3" : "pl-9 pr-3")}
              />
            </div>
            <FieldError message={fe.fullName} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">
                {t.register.emailLabel}{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
                    isRtl ? "right-3" : "left-3"
                  )}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-invalid={!!fe.email}
                  dir="ltr"
                  placeholder={t.register.emailPlaceholder}
                  className={cn(
                    "text-left font-sans transition-all",
                    isRtl ? "pr-9 pl-3" : "pl-9 pr-3"
                  )}
                />
              </div>
              <FieldError message={fe.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                {t.register.phoneLabel}{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
                    isRtl ? "right-3" : "left-3"
                  )}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                </div>
                <Input
                  id="phone"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  aria-required="true"
                  aria-invalid={!!fe.phone}
                  dir="ltr"
                  placeholder={t.register.phonePlaceholder}
                  className={cn(
                    "text-left font-sans transition-all",
                    isRtl ? "pr-9 pl-3" : "pl-9 pr-3"
                  )}
                />
              </div>
              <FieldError message={fe.phone} />
            </div>
          </div>
        </fieldset>

        {/* ── Security ─────────────────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="w-full border-b border-border pb-1.5 text-sm font-semibold text-foreground">
            {t.register.securityLegend}
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">
                {t.register.passwordLabel}{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
                    isRtl ? "right-3" : "left-3"
                  )}
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  aria-invalid={!!fe.password}
                  dir="ltr"
                  placeholder="••••••••"
                  className={cn(
                    "text-left font-sans transition-all",
                    isRtl ? "pr-9 pl-10" : "pl-9 pr-10"
                  )}
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
              <FieldError message={fe.password} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">
                {t.register.confirmPasswordLabel}{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
                    isRtl ? "right-3" : "left-3"
                  )}
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  aria-invalid={!!fe.confirmPassword}
                  dir="ltr"
                  placeholder="••••••••"
                  className={cn(
                    "text-left font-sans transition-all",
                    isRtl ? "pr-9 pl-10" : "pl-9 pr-10"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute top-0 h-full px-3 text-muted-foreground hover:bg-transparent hover:text-foreground",
                    isRtl ? "left-0" : "right-0"
                  )}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? t.login.hidePassword : t.login.showPassword}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <FieldError message={fe.confirmPassword} />
            </div>
          </div>
        </fieldset>

        {/* ── Partner Profile ──────────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="w-full border-b border-border pb-1.5 text-sm font-semibold text-foreground">
            {t.register.partnerInfoLegend}
          </legend>

          <div className="space-y-1.5">
            <Label htmlFor="experience">
              {t.register.experienceLabel}
            </Label>
            <NativeSelect
              id="experience"
              name="experience"
              defaultValue="DEBUTANT"
              className="bg-card"
            >
              <option value="DEBUTANT">{t.register.experienceDebutant}</option>
              <option value="INTERMEDIAIRE">{t.register.experienceIntermediaire}</option>
              <option value="EXPERT">{t.register.experienceExpert}</option>
            </NativeSelect>
            <FieldError message={fe.experience} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invitationCode">
              {t.register.inviteCodeLabel}
            </Label>
            <div className="relative">
              <div
                className={cn(
                  "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
                  isRtl ? "right-3" : "left-3"
                )}
              >
                <Tag className="h-4 w-4" aria-hidden="true" />
              </div>
              <Input
                id="invitationCode"
                name="invitationCode"
                defaultValue={refCode}
                placeholder={t.register.inviteCodePlaceholder}
                className={cn("transition-all", isRtl ? "pr-9 pl-3" : "pl-9 pr-3")}
              />
            </div>
            <FieldError message={fe.invitationCode} />
          </div>
        </fieldset>

        {/* ── Terms and conditions ─────────────────────────────── */}
        <div className="space-y-2 pt-1">
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="termsAccepted"
              name="termsAccepted"
              value="true"
              required
              aria-required="true"
              aria-invalid={!!fe.termsAccepted}
              className="mt-1 h-4 w-4 accent-primary cursor-pointer rounded border-input"
            />
            <Label
              htmlFor="termsAccepted"
              className="cursor-pointer text-xs font-normal leading-5 text-muted-foreground"
            >
              {t.register.termsLabel}
            </Label>
          </div>
          <FieldError message={fe.termsAccepted} />
        </div>

        {/* ── Form-level error ──────────────────────────────────── */}
        {state.error && (
          <div
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{state.error}</p>
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="w-full h-11 gap-2 font-semibold shadow-soft transition-all duration-200 hover:opacity-95 cursor-pointer"
          style={{
            backgroundColor: buttonBg,
            color: buttonText,
          }}
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {pending ? t.register.submitting : t.register.submitButton}
          {!pending && (
            isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-1">
          {t.register.alreadyRegistered}{" "}
          <Link
            href="/login"
            className="font-semibold text-primary underline-offset-4 transition-colors hover:underline hover:text-primary/90"
          >
            {t.register.loginLink}
          </Link>
        </p>
      </form>
    </div>
  );
}
