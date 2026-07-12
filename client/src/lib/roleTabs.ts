// Central tab-level permissions — single source of truth for BOTH the sidebar
// (what's shown) and the router (what's reachable). Keep this file identical in intent
// on client and server. Place at: client/src/lib/roleTabs.ts
//
// A user's role lives on the Google-login `users` record (auth.me → user.role).
// "owner" and "admin" see everything. New logins default to "user" → no access
// (a "waiting for access" screen) until an owner assigns a role in Settings.

export type AppRole =
  | "owner" | "admin"        // full access
  | "hr" | "ops_manager" | "team_lead" | "finance" | "bd"
  | "user" | "viewer";       // no access until assigned

// Path prefixes each role may reach. Owner/admin handled separately (all access).
const ROLE_PATHS: Record<string, string[]> = {
  hr: [
    "/", "/candidates", "/performance", "/payroll", "/commission",
    "/payment-preferences", "/all-documents", "/agent-profiles",
    "/leave-management", "/payroll-workflow", "/training", "/requests",
  ],
  ops_manager: [
    "/", "/operations", "/adherence", "/quality", "/coaching-admin",
    "/client-logouts", "/payroll-workflow", "/cycle-tracker", "/performance-reports", "/training",
  ],
  team_lead: [
    // near-admin: Operations + Finance + HR groups
    "/", "/operations", "/adherence", "/quality", "/coaching-admin", "/client-logouts", "/payroll-workflow",
    "/payroll", "/commission", "/payment-preferences",
    "/candidates", "/performance", "/all-documents", "/agent-profiles", "/leave-management",
    "/cycle-tracker", "/performance-reports", "/training", "/requests",
  ],
  finance: [
    "/", "/payroll", "/commission", "/payment-preferences",
  ],
  bd: [
    "/business-development", "/operations", "/adherence", "/quality",
    "/coaching-admin", "/client-logouts",
  ],
};

export function isFullAccess(role?: string | null): boolean {
  return role === "owner" || role === "admin";
}

export function hasAnyAccess(role?: string | null): boolean {
  if (isFullAccess(role)) return true;
  return !!role && !!ROLE_PATHS[role] && ROLE_PATHS[role].length > 0;
}

// Does this role reach this path? (prefix match; "/" only matches exactly)
export function canAccessPath(role: string | null | undefined, path: string): boolean {
  if (isFullAccess(role)) return true;
  const allowed = (role && ROLE_PATHS[role]) || [];
  return allowed.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/") || path.startsWith(p)));
}

// First page this role should land on (for redirects after a blocked route).
export function firstAllowedPath(role?: string | null): string {
  if (isFullAccess(role)) return "/";
  const allowed = (role && ROLE_PATHS[role]) || [];
  return allowed[0] ?? "/no-access";
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", hr: "HR", ops_manager: "Ops Manager",
  team_lead: "Team Lead", finance: "Finance", bd: "Business Dev",
  user: "No access (unassigned)", viewer: "No access",
};

// Roles an owner can assign from Settings (excludes the raw "user" default).
export const ASSIGNABLE_ROLES: AppRole[] = ["owner", "hr", "ops_manager", "team_lead", "finance", "bd", "viewer"];
