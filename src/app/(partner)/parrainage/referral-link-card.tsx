"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Share2, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function ReferralLinkCard({
  code,
  url,
}: {
  code: string;
  url: string;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Fallback if url is relative
  const fullUrl =
    typeof window !== "undefined" && url.startsWith("/")
      ? `${window.location.origin}${url}`
      : url;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      toast.success("Lien de parrainage copié dans le presse-papier !");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success("Code de parrainage copié !");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Impossible de copier le code.");
    }
  };

  const shareText = encodeURIComponent(
    `Rejoignez notre réseau de partenaires e-commerce avec mon code de parrainage ${code} : ${fullUrl}`,
  );
  const whatsappUrl = `https://wa.me/?text=${shareText}`;

  return (
    <Card className="shadow-soft border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Votre lien & code de parrainage
          </CardTitle>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Actif
          </span>
        </div>
        <CardDescription>
          Invitez de nouveaux partenaires avec votre lien unique. Dès qu&apos;ils livrent leur première commande qualifiée, vous percevez des commissions sur leur activité.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Code display */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Votre code de parrainage :
          </label>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border bg-muted/50 px-4 py-2 font-mono text-base font-extrabold tracking-wider text-foreground">
              {code}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="gap-1.5 text-xs h-10"
            >
              {copiedCode ? (
                <Check className="h-4 w-4 text-success-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedCode ? "Copié" : "Copier le code"}
            </Button>
          </div>
        </div>

        {/* Link input & copy */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">
            Votre lien direct d&apos;inscription :
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              readOnly
              value={fullUrl}
              className="font-mono text-xs bg-muted/30 text-foreground selection:bg-primary/20"
            />
            <Button
              type="button"
              variant="default"
              onClick={handleCopyLink}
              className="gap-1.5 text-xs whitespace-nowrap bg-primary shrink-0"
            >
              {copiedLink ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedLink ? "Lien copié !" : "Copier le lien"}
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-1.5 text-xs whitespace-nowrap border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 shrink-0"
            >
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Partager sur WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Share2 className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Astuce : Vos filleuls doivent simplement s&apos;inscrire via ce lien ou saisir votre code lors de leur enregistrement.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
