import Link from "next/link";

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-40 h-12 border-b bg-background flex items-center px-4">
      <Link href="/dashboard" className="font-bold text-base tracking-tight">
        ConstructHub
      </Link>
    </header>
  );
}
