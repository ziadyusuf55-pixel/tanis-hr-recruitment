import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { resolveAgentSession, type AgentSession } from "./agentAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  /** Hub (Google/OAuth) staff login, or null. */
  user: User | null;
  /** Agent-portal session — already checked for signature, revocation, status and demo flag. */
  agent: AgentSession | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // A BD teammate is identified by a bd_users link, not only by users.role. If their Hub role is still
  // the unassigned default, treat them as role "bd" for this request so the staff gate lets them in.
  // F01: "viewer" is the REVOKED state (removeUser / explicit demotion) and is never promoted.
  if (user && user.role === "user") {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const { bdUsers } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const [link] = await db.select({ id: bdUsers.id }).from(bdUsers)
          .where(and(eq(bdUsers.openId, user.openId), eq(bdUsers.active, true))).limit(1);
        if (link) user = { ...user, role: "bd" };
      }
    } catch { /* leave role as-is */ }
  }

  // Resolve (and, if revoked/inactive, strip) the agent cookie exactly once per request.
  let agent: AgentSession | null = null;
  try {
    agent = await resolveAgentSession(opts.req);
  } catch {
    agent = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    agent,
  };
}
