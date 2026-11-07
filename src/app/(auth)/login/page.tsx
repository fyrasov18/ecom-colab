import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm, type DevAccount } from "./login-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { getAuthPagesDesign, getDeliveryPartnersConfig, getPlatformBranding } from "@/modules/branding/service";

export const metadata: Metadata = { title: "Connexion" };

function devAccounts(): DevAccount[] | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return [
    { role: "Super Admin", email: "admin@ecomcolab.tn", password: "Admin123!" },
    { role: "Admin / Ops", email: "ops@ecomcolab.tn", password: "Ops12345!" },
    { role: "Partenaire", email: "nour@partner.tn", password: "Partner123!" },
  ];
}

export default async function LoginPage() {
  const [authDesign, platformBranding, deliveryPartnersConfig] = await Promise.all([
    getAuthPagesDesign(),
    getPlatformBranding(),
    getDeliveryPartnersConfig(),
  ]);

  return (
    <AuthSplitShell
      pageType="login"
      authDesign={authDesign}
      deliveryPartnersConfig={deliveryPartnersConfig}
      branding={{
        name: platformBranding.platformName,
        tagline: platformBranding.platformTagline,
        logoLight: platformBranding.logoLightUrl,
        logoDark: platformBranding.logoDarkUrl,
        logoMark: platformBranding.logoMarkUrl,
        faviconUrl: platformBranding.faviconUrl || "/brand/app-icon.svg",
        primaryColor: authDesign.colors.primaryColor,
        accentColor: authDesign.colors.accentColor,
        sidebarBg: "#0B1220",
        borderRadius: "10px",
        isPartner: false,
        isCustom: false,
      }}
    >
      <div className="animate-fade-up w-full">
        <Suspense>
          <LoginForm devAccounts={devAccounts()} authDesign={authDesign} />
        </Suspense>
      </div>
    </AuthSplitShell>
  );
}
