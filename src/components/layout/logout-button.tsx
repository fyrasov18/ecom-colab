"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await signOut({ redirect: false });
        toast.success(t("nav.logout"));
        router.push("/login");
        router.refresh();
      }}
      className="cursor-pointer"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">{t("nav.logout")}</span>
    </Button>
  );
}
