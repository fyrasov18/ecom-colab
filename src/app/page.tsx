import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(ROLE_HOME[session.user.role] ?? "/login");
  }

  return <LandingPage />;
}

