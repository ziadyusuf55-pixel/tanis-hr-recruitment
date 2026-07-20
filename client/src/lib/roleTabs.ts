// Central tab-level permissions — the single source of truth for BOTH the sidebar
// (what's visible) and the router (what's reachable).  → client/src/lib/roleTabs.ts
//
// A user's role lives on their Hub login (auth.me → user.role).
// "owner"/"admin" see everything. New logins default to "user" → no access
// (a "waiting for access" screen) until an owner assigns a role in Settings.

export type AppRole =
  | "owner" | "admin"          // full access, including Settings
  | "manager"                  // everything EXCEPT Settings
  | "hr" | "ops_manager" | "team_lead" | "finance" | "bd"
  | "user" | "viewer";         // no access until assigned

// Every page in the app, grouped the way the sidebar groups them.
const OPERATIONS = ["/operations", "/adherence", "/quality", "/coaching-admin", "/client-logouts", "/cycle-tracker"];
const HR_TABS    = ["/candidates", "/performance-reports", "/payroll", "/commission", "/payment-preferences", "/all-documents", "/agent-profiles", "/leave-management", "/academy"];
const FINANCE    = ["/payroll", "/commission", "/payment-preferences"];
const EXTRAS     = ["/requests", "/training"];

// A "manager" can reach everything except /settings.
const EVERYTHING_BUT_SETTINGS = [
  "/", ...OPERATIONS, ...HR_TABS, ...EXTRAS, "/business-development", "/my-profile",
];

const ROLE_PATHS: Record<string, string[]> = {
  manager: EVERYTHING_BUT_SETTINGS,
  hr: ["/", ...HR_TABS, "/requests", "/training", "/my-profile"],
  ops_manager: ["/", ...OPERATIONS, "/performance-reports", "/training", "/requests", "/my-profile"],
  // Near-admin: Operations + HR + Finance (no Settings, no BD)
  team_lead: ["/", ...OPERATIONS, ...HR_TABS, ...FINANCE, ...EXTRAS, "/my-profile"],
  finance: ["/", ...FINANCE, "/my-profile"],
  bd: ["/business-development", ...OPERATIONS, "/my-profile"],
};

export function isFullAccess(role?: string | null): boolean {
  return role === "owner" || role === "admin";
}

export function hasAnyAccess(role?: string | null): boolean {
  if (isFullAccess(role)) return true;
  return !!role && Array.isArray(ROLE_PATHS[role]) && ROLE_PATHS[role].length > 0;
}

/** Can this role open this path? ("/" matches only the dashboard itself.) */
export function canAccessPath(role: string | null | undefined, path: string): boolean {
  if (isFullAccess(role)) return true;
  const allowed = (role && ROLE_PATHS[role]) || [];
  return allowed.some((p) =>
    p === "/" ? path === "/" : path === p || path.startsWith(p + "/"),
  );
}

/** Where to send someone who lands on a page they can't open. */
export function firstAllowedPath(role?: string | null): string {
  if (isFullAccess(role)) return "/";
  const allowed = (role && ROLE_PATHS[role]) || [];
  return allowed[0] ?? "/";
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner — everything",
  admin: "Admin — everything",
  manager: "Manager — everything except Settings",
  hr: "HR",
  ops_manager: "Ops Manager",
  team_lead: "Team Lead",
  finance: "Finance",
  bd: "Business Dev",
  user: "No access (unassigned)",
  viewer: "No access",
};

/** Roles an owner can assign from Settings (excludes the raw "user" default). */
export const ASSIGNABLE_ROLES: AppRole[] = [
  "owner", "manager", "hr", "ops_manager", "team_lead", "finance", "bd", "viewer",
];

/** Plain-English summary of what each role can open — shown in Settings. */
export const ROLE_SUMMARY: Record<string, string> = {
  owner: "Everything, including Settings",
  admin: "Everything, including Settings",
  manager: "Everything except Settings",
  hr: "Recruitment, Performance Reports, Salary, Commission, Payment Preferences, Documents, Employee Profiles, Leave, Requests, Training",
  ops_manager: "Operations, Adherence, Quality, Coaching, Client Logouts, Cycle Tracker, Performance Reports, Requests, Training",
  team_lead: "Operations + HR + Finance (no Settings, no BD)",
  finance: "Salary, Commission, Payment Preferences",
  bd: "Business Development + Operations",
  viewer: "Nothing — waiting for access",
  user: "Nothing — waiting for access",
};
