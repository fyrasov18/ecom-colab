import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm, type DevAccount } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

/**
 * Dev-only convenience panel listing the seeded accounts.
 *
 * The list is assembled HERE, on the server, and only when NODE_ENV is not
 * production. In a production build `devAccounts` is `undefined`, so the
 * credentials are never serialised into the RSC payload or the JS bundle.
 */
function devAccounts(): DevAccount[] | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return [
    { role: "Super Admin", email: "admin@ecomcolab.tn", password: "Admin123!" },
    { role: "Admin / Ops", email: "ops@ecomcolab.tn", password: "Ops12345!" },
    { role: "Partenaire", email: "nour@partner.tn", password: "Partner123!" },
  ];
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/40 p-4">
      <Suspense>
        <LoginForm devAccounts={devAccounts()} />
      </Suspense>
    </main>
  );
}
