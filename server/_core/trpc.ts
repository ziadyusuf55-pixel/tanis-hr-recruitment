import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Role model ───────────────────────────────────────────────────────────────
// Mirrors client/src/lib/roleTabs.ts. "user" (fresh OAuth login) and "viewer"
// (removed user) have NO access anywhere — the UI shows "Waiting for access".
// The server must enforce the same thing, otherwise anyone who can sign in
// with Google reaches the whole admin API.
export type HubRole =
  | "owner" | "admin" | "manager"
  | "hr" | "ops_manager" | "team_lead" | "finance" | "bd"
  | "user" | "viewer";

export const FULL_ACCESS_ROLES: readonly HubRole[] = ["owner", "admin"];
export const NO_ACCESS_ROLES: readonly HubRole[] = ["user", "viewer"];

export function isFullAccess(role?: string | null): boolean {
  return FULL_ACCESS_ROLES.includes(role as HubRole);
}
export function isStaff(role?: string | null): boolean {
  return !!role && !NO_ACCESS_ROLES.includes(role as HubRole);
}

// ─── Middlewares ──────────────────────────────────────────────────────────────
/** Any Hub login, including unassigned/removed users. Use ONLY for auth.me-style
 *  endpoints that the "Waiting for access" screen needs. */
const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Default for every admin-side endpoint: logged in AND holds an assigned role. */
const requireStaff = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!isStaff(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your account has not been given access yet. Ask an owner to assign your role." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** owner / admin only. */
const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!isFullAccess(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Any of the listed roles (owner/admin always pass). */
export function requireRole(...roles: HubRole[]) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    const role = ctx.user.role as HubRole;
    if (!isFullAccess(role) && !roles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

/** Agent-portal login (cookie already verified + revocation-checked in context). */
const requireAgentSession = t.middleware(async ({ ctx, next }) => {
  if (!ctx.agent) throw new TRPCError({ code: "UNAUTHORIZED", message: "Agent login required" });
  return next({ ctx: { ...ctx, agent: ctx.agent } });
});

/** Agent-portal session OR a staff login — for shared read-only data (presence, leaderboard). */
const requireAgentOrStaff = t.middleware(async ({ ctx, next }) => {
  if (!ctx.agent && !(ctx.user && isStaff(ctx.user.role))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required" });
  }
  return next({ ctx });
});

// ─── Procedures ───────────────────────────────────────────────────────────────
/** Logged-in Hub user of ANY role (incl. "user"/"viewer"). Rarely what you want. */
export const protectedProcedure = t.procedure.use(requireUser);
/** Logged-in Hub user with an assigned role. The default for admin-side endpoints. */
export const staffProcedure = t.procedure.use(requireStaff);
/** owner / admin. */
export const adminProcedure = t.procedure.use(requireAdmin);
/** Build a procedure limited to specific roles, e.g. roleProcedure("hr", "manager"). */
export const roleProcedure = (...roles: HubRole[]) => t.procedure.use(requireRole(...roles));
/** Agent portal. ctx.agent is guaranteed non-null inside. */
export const agentProcedure = t.procedure.use(requireAgentSession);
/** Agent portal OR staff. Use for shared, non-sensitive reads. */
export const agentOrStaffProcedure = t.procedure.use(requireAgentOrStaff);
