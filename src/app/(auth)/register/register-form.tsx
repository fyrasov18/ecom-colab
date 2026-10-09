"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import {
  Loader2,
  UserPlus,
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EXPERIENCE_LABELS, EXPERIENCE_VALUES } from "@/modules/registration/schemas";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive mt-1" role="alert">
      {message}
    </p>
  );
}

/** Show / hide toggle for a sibling password <input> identified by fieldId. */
function PasswordToggle({ fieldId }: { fieldId: string }) {
  const shown = useRef(false);
  function toggle() {
    const input = document.getElementById(fieldId) as HTMLInputElement | null;
    if (!input) return;
    shown.current = !shown.current;
    input.type = shown.current ? "text" : "password";
    // Flip icon visibility via class mutation — avoids full re-render.
    const btn = input.nextElementSibling as HTMLButtonElement | null;
    if (btn) {
      btn.setAttribute(
        "aria-label",
        shown.current ? "Masquer le mot de passe" : "Afficher le mot de passe",
      );
      const eyeOn = btn.querySelector<SVGSVGElement>("[data-show]");
      const eyeOff = btn.querySelector<SVGSVGElement>("[data-hide]");
      if (eyeOn) eyeOn.classList.toggle("hidden", shown.current);
      if (eyeOff) eyeOff.classList.toggle("hidden", !shown.current);
    }
  }
  return (
    <button
      type="button"
      aria-label="Afficher le mot de passe"
      onClick={toggle}
      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md transition-colors"
    >
      <Eye className="h-4 w-4" aria-hidden="true" data-show />
      <EyeOff className="h-4 w-4 hidden" aria-hidden="true" data-hide />
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  /* ── Success state ──────────────────────────────────────────────────── */
  if (state.ok) {
    return (
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl">Compte créé avec succès</CardTitle>
          <CardDescription>
            {state.message ?? "Votre compte a été enregistré."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg bg-warning-50 p-4 text-warning-700 border border-warning-200">
            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Validation en attente</p>
              <p className="mt-1">
                Votre demande est maintenant en attente de validation par
                l&apos;administrateur. Vous recevrez une notification une fois
                votre compte activé.
              </p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/login">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* ── Form state ─────────────────────────────────────────────────────── */
  const fe = state.fieldErrors ?? {};

  return (
    <Card className="w-full max-w-md border-border/70 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <UserPlus className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>Rejoignez E-com Colab en tant que partenaire.</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Approval notice */}
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-warning-50 p-3 text-warning-700 border border-warning-200">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-tight">
            <strong>Approbation requise :</strong> Votre compte sera validé par
            un administrateur avant d&apos;être activé.
          </p>
        </div>

        <form action={formAction} className="space-y-6" noValidate>

          {/* ── Personal information ─────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
              Informations personnelles
            </legend>

            <div className="space-y-2">
              <Label htmlFor="fullName">
                Nom complet{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                aria-required="true"
                aria-invalid={!!fe.fullName}
                placeholder="Ex. Sami Bouazizi"
              />
              <FieldError message={fe.fullName} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">
                  E-mail{" "}
                  <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-invalid={!!fe.email}
                  placeholder="sami@exemple.tn"
                />
                <FieldError message={fe.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Téléphone{" "}
                  <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  aria-required="true"
                  aria-invalid={!!fe.phone}
                  placeholder="22 333 444"
                />
                <FieldError message={fe.phone} />
              </div>
            </div>
          </fieldset>

          {/* ── Security ─────────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
              Sécurité du compte
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Mot de passe{" "}
                  <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-required="true"
                    aria-invalid={!!fe.password}
                    placeholder="8 car. minimum"
                    className="pr-10"
                  />
                  <PasswordToggle fieldId="password" />
                </div>
                <FieldError message={fe.password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmer{" "}
                  <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-required="true"
                    aria-invalid={!!fe.confirmPassword}
                    placeholder="Répétez le mot de passe"
                    className="pr-10"
                  />
                  <PasswordToggle fieldId="confirmPassword" />
                </div>
                <FieldError message={fe.confirmPassword} />
              </div>
            </div>
          </fieldset>

          {/* ── Partner info ─────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
              Informations partenaire
            </legend>

            <div className="space-y-2">
              <Label htmlFor="invitationCode">
                Code d&apos;invitation{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="invitationCode"
                name="invitationCode"
                required
                aria-required="true"
                aria-invalid={!!fe.invitationCode}
                placeholder="Code fourni par votre contact"
              />
              <FieldError message={fe.invitationCode} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">
                Expérience e-commerce{" "}
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <NativeSelect
                id="experience"
                name="experience"
                required
                aria-required="true"
                aria-invalid={!!fe.experience}
                defaultValue=""
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {EXPERIENCE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {EXPERIENCE_LABELS[v]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={fe.experience} />
            </div>
          </fieldset>

          {/* ── Terms ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <input
                id="termsAccepted"
                name="termsAccepted"
                type="checkbox"
                value="on"
                aria-required="true"
                aria-invalid={!!fe.termsAccepted}
                className="mt-1 h-4 w-4 accent-primary cursor-pointer"
              />
              <Label
                htmlFor="termsAccepted"
                className="cursor-pointer text-xs font-normal leading-5"
              >
                J&apos;accepte les conditions d&apos;utilisation de la
                plateforme.
              </Label>
            </div>
            <FieldError message={fe.termsAccepted} />
          </div>

          {/* ── Form-level error ──────────────────────────────────── */}
          {state.error && (
            <div
              className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Créer mon compte
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
