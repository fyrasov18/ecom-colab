import Link from "next/link";
import type { Metadata } from "next";
import {
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Megaphone,
  PartyPopper,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { requireSession } from "@/lib/rbac";
import {
  getLevelUpNotificationSettings,
  getWelcomeNotificationSettings,
  listAnnouncementsAdmin,
} from "@/modules/announcements/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { NotificationPreviewModal } from "./preview-modal";

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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  SCHEDULED: "Programmée",
  ARCHIVED: "Archivée",
};

const TYPE_LABEL: Record<string, { label: string; icon: string }> = {
  PRODUCT: { label: "Produit", icon: "⭐" },
  PROMO: { label: "Offre / Promo", icon: "🔥" },
  INFO: { label: "Information", icon: "📢" },
  FEATURE: { label: "Nouveauté", icon: "✨" },
  TRAINING: { label: "Conseil", icon: "🎓" },
};

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Tous les partenaires",
  ACTIVE_ONLY: "Partenaires actifs",
  LEVEL_1: "Niveau 1 uniquement",
  LEVEL_2: "Niveau 2 uniquement",
  LEVEL_3: "Niveau 3 uniquement",
  LEVEL_4: "Niveau 4 uniquement",
  LEVEL_5: "Niveau 5 uniquement",
};

export default async function AnnouncementsAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const params = await searchParams;
  const activeTab = params.tab || "announcements";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Notifications &amp; Annonces Partenaires
          </h1>
          <p className="text-sm text-muted-foreground">
            Configurez les popups de bienvenue, les célébrations de niveau et diffusez des annonces ciblées.
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
          <div className="text-xs font-medium text-muted-foreground">Annonces créées</div>
          <div className="text-2xl font-bold mt-1">{totalAnnouncements}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {publishedCount} actuellement publiées
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Vues plein écran (Impressions)</div>
          <div className="text-2xl font-bold mt-1 text-primary">{totalImpressions}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Expositions partenaires</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Clics sur boutons CTA</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{totalClicks}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Engagements générés</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Taux de clic moyen (CTR)</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{averageCtr} %</div>
          <div className="text-xs text-muted-foreground mt-0.5">Conversion des annonces</div>
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
          📢 Annonces manuelles ({totalAnnouncements})
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
          <span>Bienvenue 1ère connexion</span>
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
          <span>Célébration Level Up</span>
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
              title="Aucune annonce pour le moment"
              description="Créez votre première annonce pour communiquer un arrivage produit, un conseil ou une nouveauté à vos partenaires."
              action={<AnnouncementModal />}
            />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Annonce &amp; Type</TableHead>
                    <TableHead>Audience ciblée</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-center">Affichages / Clics</TableHead>
                    <TableHead className="text-center">Plein écran</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((a) => {
                    const typeInfo = TYPE_LABEL[a.type] ?? { label: a.type, icon: "📢" };

                    return (
                      <TableRow key={a.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground">{a.title}</span>
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                                {typeInfo.icon} {typeInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                              {a.content}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            <Users className="h-3 w-3 mr-1" />
                            {AUDIENCE_LABEL[a.targetAudience] ?? a.targetAudience}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant={STATUS_BADGE[a.status] ?? "secondary"}>
                            {STATUS_LABEL[a.status] ?? a.status}
                          </Badge>
                          {a.status === "SCHEDULED" && a.scheduledAt && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(a.scheduledAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-semibold text-foreground">
                              {a.stats.totalDisplayed} vues · {a.stats.totalClicked} clics
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              CTR : {a.stats.clickRate} %
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          {a.isFullScreen ? (
                            <span className="inline-flex items-center text-xs text-emerald-600 font-medium">
                              ✓ Oui
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Non</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <NotificationPreviewModal
                              type="ANNOUNCEMENT"
                              title={a.title}
                              message={a.content}
                              buttonText={a.buttonText || "Consulter"}
                              buttonUrl={a.buttonUrl || "/catalogue"}
                              imageUrl={a.imageUrl || undefined}
                            />

                            <AnnouncementModal
                              announcement={{
                                id: a.id,
                                title: a.title,
                                content: a.content,
                                type: a.type,
                                imageUrl: a.imageUrl,
                                buttonText: a.buttonText,
                                buttonUrl: a.buttonUrl,
                                targetAudience: a.targetAudience,
                                status: a.status,
                                scheduledAt: a.scheduledAt,
                                isFullScreen: a.isFullScreen,
                              }}
                            />

                            <AnnouncementRowActions id={a.id} status={a.status} />
                          </div>
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

      {/* Tab 2: Welcome Settings */}
      {activeTab === "welcome" && (
        <WelcomeSettingsForm initialSettings={welcomeSettings} />
      )}

      {/* Tab 3: Level Up Settings */}
      {activeTab === "levelup" && (
        <LevelUpSettingsForm initialSettings={levelUpSettings} />
      )}
    </div>
  );
}
