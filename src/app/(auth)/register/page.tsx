import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { getAuthPagesDesign, getDeliveryPartnersConfig, getPlatformBranding } from "@/modules/branding/service";

export const metadata: Metadata = { title: "Créer un compte partenaire" };

export default async function RegisterPage() {
  const [authDesign, platformBranding, deliveryPartnersConfig] = await Promise.all([
    getAuthPagesDesign(),
    getPlatformBranding(),
    getDeliveryPartnersConfig(),
  ]);

  return (
    <AuthSplitShell
      pageType="register"
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
          <RegisterForm authDesign={authDesign} />
        </Suspense>
      </div>
    </AuthSplitShell>
  );
}
