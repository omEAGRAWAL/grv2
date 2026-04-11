"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function dismissOnboarding(): Promise<void> {
  const user = await getCurrentUser();
  await db.user.update({
    where: { id: user.id },
    data: { onboardingDismissedAt: new Date() },
  });
  revalidatePath("/dashboard");
}
