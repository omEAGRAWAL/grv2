import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — ConstructHub",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: April 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data We Collect</h2>
        <ul className="text-muted-foreground text-sm leading-relaxed space-y-1 list-disc pl-5">
          <li>Company name and owner mobile number (used as your account identifier)</li>
          <li>Employee names, usernames, and optional mobile numbers</li>
          <li>Financial data: wallet transactions, expenses, purchases, site income</li>
          <li>Usage metadata: login timestamps, IP addresses for rate limiting</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How We Use It</h2>
        <ul className="text-muted-foreground text-sm leading-relaxed space-y-1 list-disc pl-5">
          <li>To provide and operate the ConstructHub service</li>
          <li>To prevent fraud and abuse (IP-based rate limiting)</li>
          <li>We do not sell or share your data with third parties</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data Retention</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your data is retained for as long as your account is active. You may request deletion of
          your account and all associated data by contacting support.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Security</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Passwords are hashed with bcrypt. Sessions use signed, httpOnly cookies. All data is
          stored in a hosted PostgreSQL database with encryption at rest.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Privacy questions or deletion requests: support@constructhub.in
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
