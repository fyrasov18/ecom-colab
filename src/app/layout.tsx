import type { Metadata } from "next";
import { Toaster } from "sonner";
import { getDashboardDesign } from "@/modules/branding/service";
import { ThemeInjector } from "@/components/brand/theme-injector";
import { getServerLocale } from "@/lib/i18n/server";
import { I18nProvider, isRTL } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EcomPartner · Operating System",
    template: "%s · EcomPartner",
  },
  description:
    "EcomPartner — Your E-commerce Business Operating System. Together, We Grow.",
  icons: {
    icon: "/brand/app-icon.svg",
    apple: "/brand/app-icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [design, locale] = await Promise.all([
    getDashboardDesign(),
    getServerLocale(),
  ]);

  const initialDir = isRTL(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={initialDir} suppressHydrationWarning>
      <head>
        <ThemeInjector
          primaryColor={design.primaryColor}
          accentColor={design.accentColor}
          sidebarBg={design.sidebarBg}
          borderRadius={design.borderRadius}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Theme
                var qTheme = new URLSearchParams(window.location.search).get('theme');
                var theme = localStorage.getItem('theme');
                var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (qTheme === 'dark' || (!qTheme && (theme === 'dark' || (!theme && supportDark)))) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }

                // Language & Direction early detection
                var qLang = new URLSearchParams(window.location.search).get('lang');
                var storedLang = localStorage.getItem('ep_lang') || localStorage.getItem('ep_auth_lang');
                var activeLang = qLang || storedLang || '${locale}';
                if (activeLang === 'ar') {
                  document.documentElement.lang = 'ar';
                  document.documentElement.dir = 'rtl';
                } else if (activeLang === 'en') {
                  document.documentElement.lang = 'en';
                  document.documentElement.dir = 'ltr';
                } else {
                  document.documentElement.lang = 'fr';
                  document.documentElement.dir = 'ltr';
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans">
        <I18nProvider initialLocale={locale}>
          {children}
          <Toaster richColors closeButton />
        </I18nProvider>
      </body>
    </html>
  );
}
