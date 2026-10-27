import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { LoginBackground } from "@/components/ui/login-background";

export const metadata: Metadata = { title: "Créer un compte partenaire" };

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 py-12">
      <LoginBackground />
      <div className="animate-fade-up w-full max-w-lg">
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </main>
  );
}

