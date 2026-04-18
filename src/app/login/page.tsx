import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — ConstructHub",
};

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;

  const initialError =
    error === "suspended"
      ? "Your company account has been suspended. Contact support."
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">ConstructHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Construction finance management
          </p>
        </div>
        <LoginForm initialError={initialError} next={next} />
      </div>
    </main>
  );
}
