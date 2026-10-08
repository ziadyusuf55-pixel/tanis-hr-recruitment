import { COOKIE_NAME, ONE_YEAR_MS, THIRTY_DAYS_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { logSession } from "../sessionLog";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      // The state is a base64 redirectUri minted by our own login button. Refuse anything
      // pointing elsewhere — a crafted state must not be able to drive the exchange.
      try {
        const decoded = atob(state);
        const stateOrigin = new URL(decoded).origin;
        const allowed = (process.env.ALLOWED_ORIGIN ?? "https://hub.tanis-eg.com").split(",").map(o => o.trim());
        const selfOrigin = `${req.protocol}://${req.get("host")}`;
        if (process.env.NODE_ENV === "production" && !allowed.includes(stateOrigin) && stateOrigin !== selfOrigin) {
          res.status(400).json({ error: "Invalid state" });
          return;
        }
      } catch {
        res.status(400).json({ error: "Invalid state" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: THIRTY_DAYS_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });

      // Fire-and-forget session log (never blocks the redirect)
      logSession(req, userInfo.openId, userInfo.name || null).catch(() => {});

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
