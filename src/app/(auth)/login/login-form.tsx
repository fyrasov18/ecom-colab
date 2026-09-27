"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, LockKeyhole, FlaskConical } from "lucide-react";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Identifiants invalides ou compte désactivé.");
        return;
      }
      const rawCallback = searchParams.get("callbackUrl") || "/";
      // Only allow internal redirects (prevents open redirect).
      const callbackUrl =
        rawCallback.startsWith("/") && !rawCallback.startsWith("//")
          ? rawCallback
          : "/";
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const hasDevAccounts = Array.isArray(devAccounts) && devAccounts.length > 0;

  return (
    <Card className="w-full max-w-md border-border/70 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">E-COM COLAB</CardTitle>
        <CardDescription>
          Connectez-vous pour accéder à votre espace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="admin@ecomcolab.tn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Se connecter
          </Button>
        </form>

        {hasDevAccounts && (
          <div className="mt-6 space-y-2 rounded-lg border border-dashed bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" />
              Comptes de développement — cliquez pour remplir
            </p>
            <div className="grid gap-1.5">
              {devAccounts.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
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
