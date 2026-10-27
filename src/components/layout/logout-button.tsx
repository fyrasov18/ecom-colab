"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await signOut({ redirect: false });
        toast.success("Déconnecté.");
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Déconnexion</span>
    </Button>
  );
}
