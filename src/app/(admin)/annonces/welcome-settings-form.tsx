"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Save, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveWelcomeSettingsAction, type AdminAnnouncementActionState } from "./actions";
import { NotificationPreviewModal } from "./preview-modal";
import type { WelcomeSettings } from "@/modules/announcements/schemas";

const initialState: AdminAnnouncementActionState = { ok: false };

export function WelcomeSettingsForm({ initialSettings }: { initialSettings: WelcomeSettings }) {
  const [state, formAction, isPending] = useActionState(saveWelcomeSettingsAction, initialState);

  const [isEnabled, setIsEnabled] = useState(initialSettings.isEnabled);
  const [title, setTitle] = useState(initialSettings.title);
  const [message, setMessage] = useState(initialSettings.message);
  const [buttonText, setButtonText] = useState(initialSettings.buttonText);
  const [buttonUrl, setButtonUrl] = useState(initialSettings.buttonUrl);
  const [badgeText, setBadgeText] = useState(initialSettings.badgeText);
  const [imageUrl, setImageUrl] = useState(initialSettings.imageUrl ?? "");
  const [themeColor, setThemeColor] = useState(initialSettings.themeColor);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
    } else if (!state.ok && state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-indigo-500" />
              Notification de bienvenue (Première connexion)
            </CardTitle>
            <CardDescription className="mt-1">
              Affichée une seule fois en plein écran lorsqu&apos;un nouveau partenaire se connecte après l&apos;approbation de son compte par l&apos;Admin.
            </CardDescription>
          </div>
          <NotificationPreviewModal
            type="WELCOME"
            title={title}
            message={message}
            buttonText={buttonText}
            buttonUrl={buttonUrl}
            badgeText={badgeText}
            imageUrl={imageUrl}
            trigger={
              <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
                <Eye className="h-4 w-4" /> Prévisualiser
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="isEnabled" value={isEnabled ? "true" : "false"} />

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="welcome-enabled"
                checked={isEnabled}
                onCheckedChange={(checked) => setIsEnabled(Boolean(checked))}
              />
              <Label htmlFor="welcome-enabled" className="font-semibold cursor-pointer">
                Activer la notification plein écran de bienvenue
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Si désactivé, les nouveaux partenaires accèderont directement au tableau de bord sans popup.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="welcome-title">Titre du message</Label>
              <Input
                id="welcome-title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Balise disponible : <code className="bg-muted px-1 rounded">{"{partnerName}"}</code>
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="welcome-message">Message d&apos;accueil</Label>
              <textarea
                id="welcome-message"
                name="message"
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="welcome-btnText">Texte du bouton (CTA)</Label>
              <Input
                id="welcome-btnText"
                name="buttonText"
                required
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="welcome-btnUrl">Lien de destination</Label>
              <Input
                id="welcome-btnUrl"
                name="buttonUrl"
                required
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="welcome-badge">Texte du badge</Label>
              <Input
                id="welcome-badge"
                name="badgeText"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="welcome-theme">Thème visuel</Label>
              <NativeSelect
                id="welcome-theme"
                name="themeColor"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value as WelcomeSettings["themeColor"])}
              >
                <option value="indigo">Indigo / Bleu premium</option>
                <option value="emerald">Émeraude / Vert succès</option>
                <option value="amber">Ambre / Doré</option>
                <option value="purple">Violet / Majestueux</option>
                <option value="rose">Rose / Chaleureux</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="welcome-img">URL de l&apos;illustration (optionnel)</Label>
              <Input
                id="welcome-img"
                name="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-[11px] text-muted-foreground">
                Lien direct d&apos;image (.png, .jpg, .webp). Les liens de partage (Kommodo, etc.) sont convertis automatiquement.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {isPending ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
