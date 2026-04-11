"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push("/login");
    });
  }

  return (
    <Button
      variant="outline"
      className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
      onClick={handleLogout}
      disabled={isPending}
    >
      <LogOut className="h-4 w-4 mr-2" />
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
