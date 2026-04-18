import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — ConstructHub",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Acceptance</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          By creating an account on ConstructHub you agree to these Terms. If you do not agree, do
          not use the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Use of Service</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          ConstructHub is a construction finance management platform. You may use it only for lawful
          purposes in connection with your construction business. You are responsible for maintaining
          the confidentiality of your account credentials.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Data</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          You retain ownership of all financial data you enter. We store it securely to provide the
          service. See our{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          for details on what we collect and how we use it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Account Suspension</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We reserve the right to suspend or terminate accounts that violate these Terms or engage in
          fraudulent activity.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Disclaimer</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          ConstructHub is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable
          for any financial decisions made based on data in the platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Contact</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Questions about these Terms? Contact us at support@constructhub.in
        </p>
      </section>

      <p className="text-sm">
        <Link href="/login" className="underline hover:text-foreground">
          ← Back to sign in
        </Link>
      </p>
    </main>
  );
}
