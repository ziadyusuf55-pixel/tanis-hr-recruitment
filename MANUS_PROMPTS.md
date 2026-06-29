# Tanis Hub — deploy notes (schedule-swap Slack + adjustments + September fix)

Files in this bundle:
- `server/routers.ts`
- `server/db.ts`
- `server/_core/index.ts`  (flat name here: `_core_index.ts`)
- `src/.../Payroll.tsx`
- `src/.../AgentPortal.tsx`

---

## 1) Schedule-swap → management Slack channel  (routers.ts)
When both peers approve a schedule swap, the Hub now ALSO posts to the management
Slack channel (in addition to the existing email).

**Action:** add an environment variable on the server (set the value directly in
the host's env settings — do NOT commit the real URL to the repo):
```
SLACK_MANAGEMENT_WEBHOOK=<paste the #management Slack incoming-webhook URL here>
```
The management webhook URL is the same one Tito uses for management posts — take it
from the Tito script's MGMT_WEBHOOKS, or from Slack › Incoming Webhooks. If unset,
the code falls back to `SLACK_ADMIN_WEBHOOK`. No schema change.

---

## 2) Manual adjustments now reflect in net pay + admin payroll  (routers.ts, db.ts, Payroll.tsx, AgentPortal.tsx)
- Admin **Payroll → Payment Status** now folds each agent's manual adjustments into
  the **Total** column and the footer totals, and shows them in the expanded row
  (Commission + Other Bonuses/Deductions + Final Total).
- Agent payslip groups adjustments under **Other Bonuses / Other Deductions**.
- Adjustment matching is now tolerant of comma-joined CRDTS: a record stored as
  `"114071,114032"` will pick up an adjustment saved under the primary `114071`.

No schema change. **Verify:** open Payroll → Status for the month, expand an agent who
has an adjustment, confirm Final Total = Net Pay + Commission + adjustments.

> NOTE on why an adjustment may have looked "missing": the agent's headline **Net Pay**
> never includes adjustments by design — only **Final Total** does. And the admin status
> **Total** column previously ignored adjustments entirely (now fixed). Also confirm the
> adjustment's month (YYYY-MM) matches the month the payroll was uploaded under.

---

## 3) Phantom "September" cycle on agent performance history  (_core/index.ts + DB cleanup)

**Root cause:** the `POST /api/upload/cycle-stats` endpoint parsed dates with
`new Date("09/06/2026")`, which JS reads as US **MM/DD → Sept 6**, so June-09 data
(sent as `09/06`, DD/MM) was filed under September. Because `cycle_stats` has **no
unique key on (crdts, date)**, the 2-hourly pushes then inserted a *new* September row
each time → duplicated + inflated September.

**Code fix (in this bundle):** the endpoint now normalizes `DD/MM/YYYY` and `YYYY-MM-DD`
to canonical ISO before computing the cycle, so no new September rows will appear.

**DB actions you need to run (adjust table/column names to the real schema):**

```sql
-- A. Delete the phantom September cycle across all cycle tables
DELETE FROM cycle_stats        WHERE cycleKey = '2026-09';
DELETE FROM cycle_deductions   WHERE cycleKey = '2026-09';
DELETE FROM cycle_ot           WHERE cycleKey = '2026-09';
DELETE FROM coaching_sessions  WHERE cycleKey = '2026-09';

-- B. De-dupe cycle_stats, keeping the most recent row per (crdts, date)
DELETE c1 FROM cycle_stats c1
  JOIN cycle_stats c2
    ON c1.crdts = c2.crdts AND c1.date = c2.date
   AND (c1.uploadedAt < c2.uploadedAt
        OR (c1.uploadedAt = c2.uploadedAt AND c1.id < c2.id));

-- C. Add the unique key so onDuplicateKeyUpdate actually UPSERTS going forward
ALTER TABLE cycle_stats ADD UNIQUE KEY uq_cyclestats_crdts_date (crdts, date);
```
(The same latent dup issue affects `cycle_deductions` and `cycle_ot` — same dedup +
`ADD UNIQUE (crdts, date)` pattern can be applied there when convenient.)

Alternatively, step A can be done from the app with the existing admin procedure
`cycleTracker.deleteStatsForCycle({ cycleKey: "2026-09" })`.

---

## 4) RE-APPLY (recurring): keep these after pulling routers.ts / db.ts
This bundle's `routers.ts` / `db.ts` may be behind the live repo. After merge, re-apply:
- `agentSeparations.appliedAt` column + the separation procedures
  (`scheduleResignation` / `cancelScheduled` / `getPendingForAgent`).
- `getPayrollStatusPage` keeps the `pendingLeave` join — preserved in this copy.
