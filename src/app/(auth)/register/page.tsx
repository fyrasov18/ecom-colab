import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { LoginBackground } from "@/components/ui/login-background";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = { title: "Créer un compte partenaire" };

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 py-12">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle variant="outline" />
      </div>
      <LoginBackground />
      <div className="animate-fade-up w-full max-w-lg">
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </main>
  );
}
