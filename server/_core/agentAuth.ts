/**
 * Agent-portal session resolution — the ONE place agent JWTs are verified.
 *
 * Every request's tRPC context calls `resolveAgentSession(req)` once. It:
 *   1. reads the `tanis_agent_session` cookie,
 *   2. verifies the JWT signature and `type === "agent"`,
 *   3. enforces `workforce_agents.sessionRevokedAt` (terminate / resign / reset),
 *   4. blocks TERMINAL statuses only (resigned/terminated/blacklisted) — frozen
 *      and inactive agents KEEP portal access (owner decision),
 *   5. blocks demo/test accounts (`isDemo`) from the live portal,
 *   6. honours the global portal lock.
 *
 * When any check fails the cookie is REMOVED from `req.headers.cookie`, so the
 * legacy inline `getAgentCookieFromReq(ctx.req)` + `jwt.verify` call sites in
 * routers.ts all see "no cookie" and return UNAUTHORIZED / null. New code should
 * use `ctx.agent` or `requireAgent(ctx)` instead of re-verifying.
 *
 * Revocation lookups are cached per traineeCode for 15s to avoid one DB round
 * trip per request.
 */
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export const AGENT_COOKIE = "tanis_agent_session";

export type AgentSession = {
  candidateId: number;
  traineeCode: string;
  /** JWT issued-at in epoch ms */
  issuedAt: number;
};

type AgentRow = { sessionRevokedAt: number | null; agentStatus: string | null; isDemo: boolean | null };
const REVOCATION_TTL_MS = 15_000;
const _agentCache = new Map<string, { row: AgentRow | null; at: number }>();

/** Drop the cached row for one agent (call after terminate/resign/reset). */
export function invalidateAgentSessionCache(traineeCode?: string) {
  if (traineeCode) _agentCache.delete(traineeCode);
  else _agentCache.clear();
}

async function loadAgentRow(traineeCode: string): Promise<AgentRow | null> {
  const hit = _agentCache.get(traineeCode);
  const now = Date.now();
  if (hit && now - hit.at < REVOCATION_TTL_MS) return hit.row;
  let row: AgentRow | null = null;
  try {
    const { getDb } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      const { workforceAgents } = await import("../../drizzle/schema");
      const [r] = await db
        .select({
          sessionRevokedAt: workforceAgents.sessionRevokedAt,
          agentStatus: workforceAgents.agentStatus,
          isDemo: workforceAgents.isDemo,
        })
        .from(workforceAgents)
        .where(eq(workforceAgents.traineeCode, traineeCode))
        .limit(1);
      row = r ?? null;
    }
  } catch {
    // DB unavailable → fall through with no row (token-only trust, same as before)
  }
  _agentCache.set(traineeCode, { row, at: now });
  return row;
}

/** Read the raw agent cookie off a request (no verification). */
export function readAgentCookie(req: { headers: { cookie?: string } }): string | undefined {
  if (!req.headers.cookie) return undefined;
  return parseCookieHeader(req.headers.cookie)[AGENT_COOKIE];
}

/** Remove the agent cookie from the incoming Cookie header so downstream code can't see it. */
function stripAgentCookie(req: { headers: { cookie?: string } }) {
  if (!req.headers.cookie) return;
  const parsed = parseCookieHeader(req.headers.cookie);
  delete parsed[AGENT_COOKIE];
  req.headers.cookie = Object.entries(parsed)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("; ");
}

/**
 * Verify + authorise the agent session on this request.
 * Returns the session, or null (and strips the cookie) when it is invalid,
 * revoked, inactive, demo, or the portal is locked.
 */
export async function resolveAgentSession(req: Request): Promise<AgentSession | null> {
  const token = readAgentCookie(req);
  if (!token) return null;

  // DB-backed lock (same source the admin toggle writes and /api/portal-status
  // reads) — the env-only check here used to let open sessions keep mutating
  // after an admin locked the portal. The cookie is KEPT: a lock is temporary,
  // the session resumes when the portal unlocks.
  {
    const { getPortalLock } = await import("./portalLock");
    const { locked } = await getPortalLock();
    if (locked) return null;
  }

  let payload: { candidateId?: number; traineeCode?: string; type?: string; iat?: number };
  try {
    payload = jwt.verify(token, ENV.cookieSecret) as typeof payload;
  } catch {
    stripAgentCookie(req);
    return null;
  }
  if (payload.type !== "agent" || !payload.traineeCode || typeof payload.candidateId !== "number") {
    stripAgentCookie(req);
    return null;
  }

  const issuedAt = (payload.iat ?? 0) * 1000;
  const row = await loadAgentRow(payload.traineeCode);
  if (row) {
    // iat has SECOND precision while sessionRevokedAt has ms precision — a token
    // issued in the same second as the revocation (changePassword re-issues one
    // immediately after revoking) must count as issued AFTER it.
    if (row.sessionRevokedAt && issuedAt + 999 < row.sessionRevokedAt) {
      stripAgentCookie(req);
      return null;
    }
    // Only terminal statuses lose portal access. Frozen / on-notice / inactive agents
    // keep their login (owner decision): they still need payslips, requests and documents.
    if (row.agentStatus && ["resigned", "terminated", "blacklisted"].includes(row.agentStatus)) {
      stripAgentCookie(req);
      return null;
    }
    // Demo/test agents (isDemo) may log in — the owner uses them to test the portal — but they are excluded
    // from every report and headcount. Set BLOCK_DEMO_AGENT_LOGIN=true to refuse them entirely.
    if (row.isDemo && process.env.BLOCK_DEMO_AGENT_LOGIN === "true") {
      stripAgentCookie(req);
      return null;
    }
  }

  return { candidateId: payload.candidateId, traineeCode: payload.traineeCode, issuedAt };
}

/** Throw UNAUTHORIZED unless the request carries a valid, non-revoked agent session. */
export function requireAgent(ctx: { agent: AgentSession | null }): AgentSession {
  if (!ctx.agent) throw new TRPCError({ code: "UNAUTHORIZED", message: "Agent login required" });
  return ctx.agent;
}
