import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            ConstructHub
          </h1>
          <p className="text-muted-foreground text-lg">
            Multi-site construction finance management for Indian companies.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Manage sites, wallets, vendors, and P&amp;L — all in one place.
        </p>
      </div>
    </main>
  );
}
