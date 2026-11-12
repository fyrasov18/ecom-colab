import Link from "next/link";
import type { Metadata } from "next";
import {
  Megaphone,
  PartyPopper,
  Star,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import {
  getLevelUpNotificationSettings,
  getWelcomeNotificationSettings,
  listAnnouncementsAdmin,
} from "@/modules/announcements/service";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnnouncementModal } from "./announcement-modal";
import { AnnouncementRowActions } from "./announcement-row-actions";
import { WelcomeSettingsForm } from "./welcome-settings-form";
import { LevelUpSettingsForm } from "./level-up-settings-form";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Notifications & Annonces Partenaires" };

type SearchParams = Promise<{
  tab?: "announcements" | "welcome" | "levelup";
}>;

const STATUS_BADGE: Record<string, "secondary" | "success" | "warning" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "outline",
};

export default async function AnnouncementsAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const params = await searchParams;
  const activeTab = params.tab || "announcements";

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.announcements;
  const c = dict.common;

  const [announcements, welcomeSettings, levelUpSettings] = await Promise.all([
    listAnnouncementsAdmin(),
    getWelcomeNotificationSettings(),
    getLevelUpNotificationSettings(),
  ]);

  // Aggregate stats
  const totalAnnouncements = announcements.length;
  const publishedCount = announcements.filter((a) => a.status === "PUBLISHED").length;
  const totalImpressions = announcements.reduce((sum, a) => sum + a.stats.totalDisplayed, 0);
  const totalClicks = announcements.reduce((sum, a) => sum + a.stats.totalClicked, 0);
  const averageCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 100) : 0;

  const statusLabel: Record<string, string> = {
    DRAFT: locale === "ar" ? "مسودة" : locale === "en" ? "Draft" : "Brouillon",
    PUBLISHED: locale === "ar" ? "منشور" : locale === "en" ? "Published" : "Publiée",
    SCHEDULED: locale === "ar" ? "مجدول" : locale === "en" ? "Scheduled" : "Programmée",
    ARCHIVED: locale === "ar" ? "مؤرشف" : locale === "en" ? "Archived" : "Archivée",
  };

  const typeLabel: Record<string, { label: string; icon: string }> = {
    PRODUCT: { label: locale === "ar" ? "منتج" : locale === "en" ? "Product" : "Produit", icon: "⭐" },
    PROMO: { label: locale === "ar" ? "عرض ترويجي" : locale === "en" ? "Promo / Offer" : "Offre / Promo", icon: "🔥" },
    INFO: { label: locale === "ar" ? "معلومات" : locale === "en" ? "Information" : "Information", icon: "📢" },
    FEATURE: { label: locale === "ar" ? "ميزة جديدة" : locale === "en" ? "New Feature" : "Nouveauté", icon: "✨" },
    TRAINING: { label: locale === "ar" ? "نصيحة وتدريب" : locale === "en" ? "Advice & Training" : "Conseil", icon: "🎓" },
  };

  const audienceLabel: Record<string, string> = {
    ALL: t.allPartners,
    ACTIVE_ONLY: locale === "ar" ? "الشركاء النشطون فقط" : locale === "en" ? "Active partners only" : "Partenaires actifs",
    LEVEL_1: locale === "ar" ? "المستوى 1 فقط" : locale === "en" ? "Level 1 only" : "Niveau 1 uniquement",
    LEVEL_2: locale === "ar" ? "المستوى 2 فقط" : locale === "en" ? "Level 2 only" : "Niveau 2 uniquement",
    LEVEL_3: locale === "ar" ? "المستوى 3 فقط" : locale === "en" ? "Level 3 only" : "Niveau 3 uniquement",
    LEVEL_4: locale === "ar" ? "المستوى 4 فقط" : locale === "en" ? "Level 4 only" : "Niveau 4 uniquement",
    LEVEL_5: locale === "ar" ? "المستوى 5 فقط" : locale === "en" ? "Level 5 only" : "Niveau 5 uniquement",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        {activeTab === "announcements" && (
          <div className="flex items-center gap-2">
            <AnnouncementModal />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "إعلانات منشأة" : locale === "en" ? "Created announcements" : "Annonces créées"}</div>
          <div className="text-2xl font-bold mt-1">{totalAnnouncements}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {publishedCount} {locale === "ar" ? "منشورة حالياً" : locale === "en" ? "currently published" : "actuellement publiées"}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "المشاهدات (Impressions)" : locale === "en" ? "Views (Impressions)" : "Vues plein écran (Impressions)"}</div>
          <div className="text-2xl font-bold mt-1 text-primary">{totalImpressions}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{locale === "ar" ? "ظهور للشركاء" : locale === "en" ? "Partner impressions" : "Expositions partenaires"}</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "النقرات على CTA" : locale === "en" ? "Clicks on CTA" : "Clics sur boutons CTA"}</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{totalClicks}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{locale === "ar" ? "تفاعل محقق" : locale === "en" ? "Generated engagements" : "Engagements générés"}</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">{locale === "ar" ? "معدل النقر (CTR)" : locale === "en" ? "Average CTR" : "Taux de clic moyen (CTR)"}</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{averageCtr} %</div>
          <div className="text-xs text-muted-foreground mt-0.5">{locale === "ar" ? "تحويل الإعلانات" : locale === "en" ? "Ad conversions" : "Conversion des annonces"}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto scrollbar-none">
        <Link
          href="/annonces?tab=announcements"
          className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
            activeTab === "announcements"
              ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
              : "border-border hover:bg-muted text-muted-foreground"
          }`}
        >
          📢 {locale === "ar" ? "إعلانات يدوية" : locale === "en" ? "Manual announcements" : "Annonces manuelles"} ({totalAnnouncements})
        </Link>

        <Link
          href="/annonces?tab=welcome"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
            activeTab === "welcome"
              ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
              : "border-border hover:bg-muted text-muted-foreground"
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          <span>{t.welcomePopup}</span>
          <span
            className={`h-2 w-2 rounded-full ${
              welcomeSettings.isEnabled ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
          />
        </Link>

        <Link
          href="/annonces?tab=levelup"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
            activeTab === "levelup"
              ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
              : "border-border hover:bg-muted text-muted-foreground"
          }`}
        >
          <PartyPopper className="h-3.5 w-3.5" />
          <span>{t.levelUpPopup}</span>
          <span
            className={`h-2 w-2 rounded-full ${
              levelUpSettings.isEnabled ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
          />
        </Link>
      </div>

      {/* Tab 1: Manual Announcements List */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <EmptyState
              title={locale === "ar" ? "لا توجد إعلانات حالياً" : locale === "en" ? "No announcements yet" : "Aucune annonce pour le moment"}
              description={locale === "ar" ? "أنشئ إعلانك الأول لإعلام الشركاء بوصول منتجات أو نصائح جديدة." : locale === "en" ? "Create your first announcement to share arrivals or tips with partners." : "Créez votre première annonce pour communiquer un arrivage produit, un conseil ou une nouveauté à vos partenaires."}
              action={<AnnouncementModal />}
            />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === "ar" ? "الإعلان والنوع" : locale === "en" ? "Announcement & Type" : "Annonce & Type"}</TableHead>
                    <TableHead>{t.targetPartners}</TableHead>
                    <TableHead className="text-center">{c.status}</TableHead>
                    <TableHead className="text-center">{t.impressions} / {t.conversions}</TableHead>
                    <TableHead className="text-center">{locale === "ar" ? "شاشة كاملة" : locale === "en" ? "Full screen" : "Plein écran"}</TableHead>
                    <TableHead className="text-right">{c.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((a) => {
                    const typeInfo = typeLabel[a.type] ?? { label: a.type, icon: "📢" };

                    return (
                      <TableRow key={a.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-start gap-2.5">
                            <span className="text-lg">{typeInfo.icon}</span>
                            <div>
                              <div className="font-semibold text-foreground text-sm line-clamp-1">
                                {a.title}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {a.content}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {audienceLabel[a.targetAudience] ?? a.targetAudience}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant={STATUS_BADGE[a.status]}>
                            {statusLabel[a.status] ?? a.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center text-xs font-mono">
                          <span className="text-primary font-semibold">{a.stats.totalDisplayed}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-emerald-600 font-semibold">{a.stats.totalClicked}</span>
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="text-xs text-muted-foreground">
                            {a.isFullScreen ? (locale === "ar" ? "نعم" : locale === "en" ? "Yes" : "Oui") : (locale === "ar" ? "لا" : locale === "en" ? "No" : "Non")}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <AnnouncementRowActions id={a.id} status={a.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Welcome Notification Settings */}
      {activeTab === "welcome" && (
        <div className="space-y-4">
          <WelcomeSettingsForm initialSettings={welcomeSettings} />
        </div>
      )}

      {/* Tab 3: Level Up Celebration Settings */}
      {activeTab === "levelup" && (
        <div className="space-y-4">
          <LevelUpSettingsForm initialSettings={levelUpSettings} />
        </div>
      )}
    </div>
  );
}
