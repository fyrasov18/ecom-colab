import type { Metadata } from "next";
import { Toaster } from "sonner";
import { getDashboardDesign } from "@/modules/branding/service";
import { ThemeInjector } from "@/components/brand/theme-injector";
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
  const design = await getDashboardDesign();

  return (
    <html lang="fr" suppressHydrationWarning>
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
                var qTheme = new URLSearchParams(window.location.search).get('theme');
                var theme = localStorage.getItem('theme');
                var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (qTheme === 'dark' || (!qTheme && (theme === 'dark' || (!theme && supportDark)))) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
