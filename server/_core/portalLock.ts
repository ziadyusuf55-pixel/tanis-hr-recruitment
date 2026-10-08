/**
 * ONE portal-lock truth for the whole server. The admin toggle writes
 * app_settings.portal_locked; everything that enforces or reports the lock
 * reads it through here (30s cache; the AGENT_PORTAL_LOCKED env var only
 * seeds the cache before the first DB read).
 *
 * Before this module, agentAuth checked the ENV only while /api/portal-status
 * and agent.login checked the DB: flipping the admin toggle did not stop
 * already-open sessions' mutations until their next `me` poll, and an env/db
 * disagreement produced a silent login loop with no lock message.
 */
let _locked = process.env.AGENT_PORTAL_LOCKED === "true";
let _message = "The agent portal is temporarily locked. Please contact your manager.";
let _last = 0;

export async function getPortalLock(): Promise<{ locked: boolean; message: string }> {
  const now = Date.now();
  if (now - _last > 30_000) {
    _last = now;
    try {
      const { getDb } = await import("../db");
      const { appSettings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "portal_locked")).limit(1);
        if (row) _locked = row.value === "true";
        const [msgRow] = await db.select().from(appSettings).where(eq(appSettings.key, "portal_lock_message")).limit(1);
        if (msgRow) _message = msgRow.value;
      }
    } catch { /* keep the cached value */ }
  }
  return { locked: _locked, message: _message };
}

/** Make the next getPortalLock() re-read the DB immediately (call after toggling the lock). */
export function invalidatePortalLockCache() {
  _last = 0;
}
