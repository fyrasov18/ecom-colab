import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/40 p-4">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
