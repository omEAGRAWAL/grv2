import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create Account — ConstructHub",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">ConstructHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Construction finance management
          </p>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}
