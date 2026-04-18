"use client";

import { useActionState } from "react";
import { signupCompany } from "@/app/actions/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

function FieldError({ field, current, message }: { field: string; current?: string; message: string }) {
  if (current !== field) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupCompany, null);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && !state.field && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              name="companyName"
              type="text"
              autoComplete="organization"
              disabled={isPending}
              required
              placeholder="Sharma Constructions"
              aria-invalid={state?.field === "companyName"}
            />
            <FieldError field="companyName" current={state?.field} message={state?.error ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ownerName">Your full name</Label>
            <Input
              id="ownerName"
              name="ownerName"
              type="text"
              autoComplete="name"
              disabled={isPending}
              required
              placeholder="Rajesh Sharma"
              aria-invalid={state?.field === "ownerName"}
            />
            <FieldError field="ownerName" current={state?.field} message={state?.error ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              disabled={isPending}
              required
              placeholder="9876543210"
              aria-invalid={state?.field === "mobile"}
            />
            <FieldError field="mobile" current={state?.field} message={state?.error ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              disabled={isPending}
              required
              placeholder="rajesh_sharma"
              aria-invalid={state?.field === "username"}
            />
            <FieldError field="username" current={state?.field} message={state?.error ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              disabled={isPending}
              required
              aria-invalid={state?.field === "password"}
            />
            <FieldError field="password" current={state?.field} message={state?.error ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isPending}
              required
              aria-invalid={state?.field === "confirmPassword"}
            />
            <FieldError field="confirmPassword" current={state?.field} message={state?.error ?? ""} />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="tos"
              name="tos"
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 rounded border-slate-600 accent-primary"
              disabled={isPending}
            />
            <Label htmlFor="tos" className="text-sm font-normal leading-snug text-muted-foreground">
              I agree to the{" "}
              <Link href="/terms" className="underline hover:text-foreground" target="_blank">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-foreground" target="_blank">
                Privacy Policy
              </Link>
            </Label>
          </div>
          {state?.field === "tos" && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-foreground">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
