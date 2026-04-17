import type { User } from "@prisma/client";

export type Action =
  | "create:site"
  | "update:site"
  | "view:site"
  | "create:employee"
  | "update:employee"
  | "reset:employee-password"
  | "topup:wallet"
  | "create:expense"
  | "void:expense"
  | "create:transfer"
  | "void:transfer"
  | "create:purchase"
  | "void:purchase"
  | "create:material-transfer"
  | "void:material-transfer"
  | "create:income"
  | "void:income"
  | "view:reports"
  | "export:csv"
  | "manage:vendors"
  | "manage:company"
  | "super:admin";

type ResourceContext = {
  /** userId of the resource owner (e.g. whose expense is being voided) */
  ownerId?: string;
  /** siteId the resource belongs to */
  siteId?: string;
  /** siteIds the current user is assigned to (for SUPERVISOR checks) */
  assignedSiteIds?: string[];
};

const ROLE_PERMISSIONS: Record<string, Set<Action>> = {
  SUPERADMIN: new Set<Action>([
    "super:admin",
    "manage:company",
    "create:site",
    "update:site",
    "view:site",
    "create:employee",
    "update:employee",
    "reset:employee-password",
    "topup:wallet",
    "create:expense",
    "void:expense",
    "create:transfer",
    "void:transfer",
    "create:purchase",
    "void:purchase",
    "create:material-transfer",
    "void:material-transfer",
    "create:income",
    "void:income",
    "view:reports",
    "export:csv",
    "manage:vendors",
  ]),
  OWNER: new Set<Action>([
    "manage:company",
    "create:site",
    "update:site",
    "view:site",
    "create:employee",
    "update:employee",
    "reset:employee-password",
    "topup:wallet",
    "create:expense",
    "void:expense",
    "create:transfer",
    "void:transfer",
    "create:purchase",
    "void:purchase",
    "create:material-transfer",
    "void:material-transfer",
    "create:income",
    "void:income",
    "view:reports",
    "export:csv",
    "manage:vendors",
  ]),
  SITE_MANAGER: new Set<Action>([
    "view:site",
    "create:expense",
    "void:expense",
    "create:transfer",
    "void:transfer",
    "create:purchase",
    "void:purchase",
    "create:material-transfer",
    "void:material-transfer",
    "create:income",
    "void:income",
    "view:reports",
    "export:csv",
    "manage:vendors",
  ]),
  SUPERVISOR: new Set<Action>([
    "view:site",
    "create:expense",
    "void:expense",
    "create:purchase",
    "void:purchase",
  ]),
  WORKER: new Set<Action>([
    "view:site",
    "create:expense",
  ]),
  // Legacy role kept for backwards compatibility
  EMPLOYEE: new Set<Action>([
    "view:site",
    "create:expense",
  ]),
};

/**
 * Returns true if the user is permitted to perform the given action.
 *
 * For SUPERVISOR, also checks that the resource siteId is in their
 * assignedSiteIds (when provided).
 */
export function can(
  user: Pick<User, "role">,
  action: Action,
  resource?: ResourceContext
): boolean {
  const perms = ROLE_PERMISSIONS[user.role];
  if (!perms) return false;
  if (!perms.has(action)) return false;

  // SUPERVISOR is site-scoped: must be assigned to the site
  if (
    user.role === "SUPERVISOR" &&
    resource?.siteId &&
    resource?.assignedSiteIds &&
    !resource.assignedSiteIds.includes(resource.siteId)
  ) {
    return false;
  }

  return true;
}

/**
 * Throws if the user cannot perform the action.
 */
export function assertCan(
  user: Pick<User, "role">,
  action: Action,
  resource?: ResourceContext
): void {
  if (!can(user, action, resource)) {
    throw new Error(`Forbidden: cannot perform '${action}'`);
  }
}
