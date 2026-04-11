import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletReconcile } from "@/lib/wallet-reconcile";

export async function GET(req: NextRequest) {
  // Auth: must be logged in; only owner can query other users
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Employees may only see their own reconciliation
  if (currentUser.role !== "OWNER" && currentUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getWalletReconcile(userId);

  // Serialize BigInts as strings (JSON.stringify doesn't handle BigInt)
  const serialized = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === "bigint" ? v.toString() : v,
    ])
  );

  return NextResponse.json(serialized);
}
