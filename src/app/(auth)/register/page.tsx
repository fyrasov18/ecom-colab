import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { RegisterHeroVisual } from "@/components/auth/register-hero-visual";

export const metadata: Metadata = { title: "Créer un compte partenaire" };

export default function RegisterPage() {
  return (
    <AuthSplitShell heroVisual={<RegisterHeroVisual />}>
      <div className="animate-fade-up w-full">
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </AuthSplitShell>
  );
}
