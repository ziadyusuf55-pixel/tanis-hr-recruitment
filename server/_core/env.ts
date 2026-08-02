export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: (() => {
    const s = process.env.JWT_SECRET ?? "";
    if (!s) {
      // In production crash if JWT_SECRET is completely missing
      if (process.env.NODE_ENV === "production") throw new Error("FATAL: JWT_SECRET must be set.");
      console.warn("⚠️  JWT_SECRET is missing — using insecure fallback. Set it in production.");
    }
    return s || "dev-insecure-fallback-do-not-use-in-production";
  })(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  hubspotApiToken: process.env.HUBSPOT_API_TOKEN ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // Set to "true" to lock the agent portal (blocks new logins AND kicks active sessions).
  // Admins are NOT affected. Leave unset (or any value != "true") to keep portal open.
  agentPortalLocked: process.env.AGENT_PORTAL_LOCKED === "true",
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  slackChannelId: process.env.SLACK_CHANNEL_ID ?? "",   // fallback channel if no DM found
  uploadSecret: process.env.UPLOAD_SECRET ?? "",         // shared secret for Apps Script push
};
