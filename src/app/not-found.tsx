import Link from "next/link";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <HardHat className="h-14 w-14 text-muted-foreground/40" />
      <div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This page doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
