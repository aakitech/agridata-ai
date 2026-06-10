/**
 * Centralized permission system for AgriData Technologies
 *
 * Roles:
 * - super_admin: Full system control and training-impacting decisions
 * - org_admin: Organization data viewing and soft triage annotations
 * - officer: WhatsApp bot access only (no dashboard)
 */

export const PERMISSIONS = {
  // Super Admin exclusive
  INVITE_USERS: "invite:users",
  MANAGE_ALL_ORGS: "manage:all_orgs",
  VIEW_ALL_ORGS: "view:all_orgs",
  HARD_TRIAGE: "triage:hard", // Accept/reject for training

  // Org Admin capabilities
  READ_ORG_DATA: "read:org_data",
  VIEW_DASHBOARDS: "view:dashboards",
  SOFT_TRIAGE: "triage:soft", // Annotations, flags, comments
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type Role = "super_admin" | "org_admin" | "officer";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  org_admin: [
    PERMISSIONS.READ_ORG_DATA,
    PERMISSIONS.VIEW_DASHBOARDS,
    PERMISSIONS.SOFT_TRIAGE,
  ],
  officer: [],
} as const;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role can perform hard triage (accept/reject for training)
 */
export function canHardTriage(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.HARD_TRIAGE);
}

/**
 * Check if a role can perform soft triage (annotations, flags, comments)
 */
export function canSoftTriage(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.SOFT_TRIAGE);
}

/**
 * Check if a role can view all organizations' data
 */
export function canViewAllOrgs(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.VIEW_ALL_ORGS);
}

/**
 * Check if a role can invite users
 */
export function canInviteUsers(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.INVITE_USERS);
}
