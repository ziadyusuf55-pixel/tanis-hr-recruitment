-- ============================================================
-- Restore EGP 1,000 commission for ALL active agents
-- Pay cycle: 2026-05   (performance month: March 2026)
--
-- Idempotent: safe to run more than once. Mirrors
-- restore-may2026-commission.mjs but as pure SQL you can paste
-- into the DB console (or hand to Manus).
-- ============================================================

-- 1) Update active agents who ALREADY have a May-2026 commission row -> 1000
UPDATE commissions
SET commissionEgp   = '1000.00',
    performanceMonth = 'March 2026'
WHERE paymentCycle = '2026-05'
  AND crdts IN (
    SELECT crdts FROM workforce_agents
    WHERE agentStatus = 'active' AND crdts IS NOT NULL AND crdts <> ''
  );

-- 2) Insert a 1000 row for active agents who DON'T have one yet
INSERT INTO commissions
  (crdts, alias, commissionEgp, performanceMonth, paymentCycle, paymentStatus, uploadedAt)
SELECT wa.crdts,
       COALESCE(wa.alias, wa.fullName),
       '1000.00',
       'March 2026',
       '2026-05',
       'pending',
       UNIX_TIMESTAMP() * 1000
FROM workforce_agents wa
WHERE wa.agentStatus = 'active'
  AND wa.crdts IS NOT NULL AND wa.crdts <> ''
  AND NOT EXISTS (
    SELECT 1 FROM commissions c
    WHERE c.crdts = wa.crdts AND c.paymentCycle = '2026-05'
  );

-- 3) Sync the amount into existing May-2026 payroll records
UPDATE payroll_records pr
JOIN workforce_agents wa ON wa.crdts = pr.crdts
SET pr.commissionEgp = '1000.00'
WHERE pr.month = '2026-05'
  AND wa.agentStatus = 'active';

-- Quick check after running:
-- SELECT COUNT(*) AS rows_1000 FROM commissions WHERE paymentCycle = '2026-05' AND commissionEgp = '1000.00';
