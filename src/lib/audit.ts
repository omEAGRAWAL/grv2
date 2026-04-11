import type { User } from "@prisma/client";

type Action =
  | "CREATE_SITE"
  | "EDIT_SITE"
  | "TOP_UP_WALLET"
  | "VIEW_ALL_BALANCES";

export function canPerform(user: User, action: Action): boolean {
  switch (action) {
    case "CREATE_SITE":
    case "EDIT_SITE":
    case "TOP_UP_WALLET":
    case "VIEW_ALL_BALANCES":
      return user.role === "OWNER";
    default:
      return false;
  }
}
