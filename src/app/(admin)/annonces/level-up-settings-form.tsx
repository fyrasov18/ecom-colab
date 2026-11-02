"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, PartyPopper, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveLevelUpSettingsAction, type AdminAnnouncementActionState } from "./actions";
import { NotificationPreviewModal } from "./preview-modal";
import type { LevelUpSettings } from "@/modules/announcements/schemas";

const initialState: AdminAnnouncementActionState = { ok: false };

export function LevelUpSettingsForm({ initialSettings }: { initialSettings: LevelUpSettings }) {
  const [state, formAction, isPending] = useActionState(saveLevelUpSettingsAction, initialState);

  const [isEnabled, setIsEnabled] = useState(initialSettings.isEnabled);
  const [title, setTitle] = useState(initialSettings.title);
  const [message, setMessage] = useState(initialSettings.message);
  const [buttonText, setButtonText] = useState(initialSettings.buttonText);
  const [buttonUrl, setButtonUrl] = useState(initialSettings.buttonUrl);
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
              <PartyPopper className="h-5 w-5 text-amber-500" />
              Notification de changement de niveau (Level Up)
            </CardTitle>
            <CardDescription className="mt-1">
              Affichée en plein écran avec animation de confettis uniquement lorsqu&apos;un partenaire passe à un niveau supérieur après confirmation officielle de l&apos;Admin.
            </CardDescription>
          </div>
          <NotificationPreviewModal
            type="LEVEL_UP"
            title={title}
            message={message}
            buttonText={buttonText}
            buttonUrl={buttonUrl}
            imageUrl={imageUrl}
            metadata={{ oldLevel: 1, newLevel: 2, newRate: 0.07 }}
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
                id="levelup-enabled"
                checked={isEnabled}
                onCheckedChange={(checked) => setIsEnabled(Boolean(checked))}
              />
              <Label htmlFor="levelup-enabled" className="font-semibold cursor-pointer">
                Activer la célébration de montée de niveau (Level Up)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Ne se déclenche jamais pour une simple demande en attente. Uniquement après validation effective de la promotion.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="levelup-title">Titre de félicitations</Label>
              <Input
                id="levelup-title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Balises disponibles : <code className="bg-muted px-1 rounded">{"{partnerName}"}</code>, <code className="bg-muted px-1 rounded">{"{newLevel}"}</code>, <code className="bg-muted px-1 rounded">{"{oldLevel}"}</code>, <code className="bg-muted px-1 rounded">{"{commissionRate}"}</code>
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="levelup-message">Message de célébration</Label>
              <textarea
                id="levelup-message"
                name="message"
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="levelup-btnText">Texte du bouton (CTA)</Label>
              <Input
                id="levelup-btnText"
                name="buttonText"
                required
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="levelup-btnUrl">Lien de destination</Label>
              <Input
                id="levelup-btnUrl"
                name="buttonUrl"
                required
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="levelup-theme">Thème visuel</Label>
              <NativeSelect
                id="levelup-theme"
                name="themeColor"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value as any)}
              >
                <option value="amber">Ambre / Festif doré</option>
                <option value="indigo">Indigo / Bleu prestige</option>
                <option value="emerald">Émeraude / Réussite</option>
                <option value="purple">Violet / VIP</option>
                <option value="rose">Rose / Rubis</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="levelup-img">URL de l&apos;image / bannière (optionnel)</Label>
              <Input
                id="levelup-img"
                name="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
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
