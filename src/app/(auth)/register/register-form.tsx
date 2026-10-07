"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPERIENCE_LABELS, EXPERIENCE_VALUES } from "@/modules/registration/schemas";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  if (state.ok) {
    return (
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UserPlus className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Compte créé</CardTitle>
          <CardDescription>{state.message ?? "Compte créé. En attente de validation par l’administrateur."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fe = state.fieldErrors ?? {};
  return (
    <Card className="w-full max-w-md border-border/70 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <UserPlus className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Créez votre compte partenaire. Validation par l’administrateur requise.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required placeholder="Ex. Sami Bouazizi" />
            <FieldError message={fe.fullName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="sami@exemple.tn" />
              <FieldError message={fe.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" autoComplete="tel" required placeholder="Ex. 22 333 444" />
              <FieldError message={fe.phone} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required placeholder="8 caractères minimum" />
              <FieldError message={fe.password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required placeholder="Répétez le mot de passe" />
              <FieldError message={fe.confirmPassword} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invitationCode">Code d’invitation <span className="text-destructive">*</span></Label>
            <Input id="invitationCode" name="invitationCode" required placeholder="Ex. admin" />
            <FieldError message={fe.invitationCode} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="experience">Expérience e-commerce</Label>
            <NativeSelect id="experience" name="experience" required defaultValue="">
              <option value="" disabled>Choisir…</option>
              {EXPERIENCE_VALUES.map((v) => (
                <option key={v} value={v}>{EXPERIENCE_LABELS[v]}</option>
              ))}
            </NativeSelect>
            <FieldError message={fe.experience} />
          </div>
          <div className="flex items-start gap-2">
            <input id="termsAccepted" name="termsAccepted" type="checkbox" value="on" className="mt-1 h-4 w-4 accent-primary" />
            <Label htmlFor="termsAccepted" className="text-xs font-normal leading-5">
              J’accepte les conditions d’utilisation de la plateforme.
            </Label>
          </div>
          <FieldError message={fe.termsAccepted} />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer mon compte
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ? <Link href="/login" className="text-primary underline-offset-4 hover:underline">Se connecter</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
