import type { User } from "@prisma/client";

/**
 * Phase 0 stub: check whether a user can perform an action.
 * Currently grants all permissions to OWNER, none to EMPLOYEE.
 * Will be expanded with granular per-action rules in later phases.
 */
export function canPerform(user: User, _action: string): boolean {
  return user.role === "OWNER";
}
