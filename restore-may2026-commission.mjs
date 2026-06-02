/**
 * One-time script: restore EGP 1,000 training bonus commission for all active agents
 * in the May 2026 pay cycle (performance month: March 2026).
 * Run: node restore-may2026-commission.mjs
 */
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config({ path: ".env" });

const db = await createConnection(process.env.DATABASE_URL);

// 1. Get all active agents with CRDTS
const [agents] = await db.query(
  `SELECT crdts, COALESCE(alias, fullName) as displayName
   FROM workforce_agents
   WHERE agentStatus = 'active' AND crdts IS NOT NULL AND crdts != ''`
);

console.log(`Found ${agents.length} active agents with CRDTS`);

let inserted = 0;
let updated = 0;

for (const agent of agents) {
  const [rows] = await db.query(
    `SELECT id, commissionEgp FROM commissions WHERE crdts = ? AND paymentCycle = '2026-05'`,
    [agent.crdts]
  );
  if (rows.length > 0) {
    await db.query(
      `UPDATE commissions SET commissionEgp = '1000.00', performanceMonth = 'March 2026' WHERE crdts = ? AND paymentCycle = '2026-05'`,
      [agent.crdts]
    );
    updated++;
    console.log(`  Updated ${agent.crdts} (${agent.displayName}): was ${rows[0].commissionEgp} → 1000`);
  } else {
    await db.query(
      `INSERT INTO commissions (crdts, alias, commissionEgp, performanceMonth, paymentCycle, paymentStatus, uploadedAt)
       VALUES (?, ?, '1000.00', 'March 2026', '2026-05', 'pending', ?)`,
      [agent.crdts, agent.displayName, Date.now()]
    );
    inserted++;
    console.log(`  Inserted ${agent.crdts} (${agent.displayName}): 1000 EGP`);
  }
}

// 2. Also sync to payroll_records for May 2026
const [payrollRows] = await db.query(
  `SELECT crdts FROM payroll_records WHERE month = '2026-05'`
);
const payrollCrdts = new Set(payrollRows.map(r => r.crdts));

for (const agent of agents) {
  if (payrollCrdts.has(agent.crdts)) {
    await db.query(
      `UPDATE payroll_records SET commissionEgp = '1000.00' WHERE crdts = ? AND month = '2026-05'`,
      [agent.crdts]
    );
    console.log(`  Synced payroll for ${agent.crdts}`);
  }
}

await db.end();
console.log(`\nDone: ${inserted} inserted, ${updated} updated. Payroll synced for ${payrollCrdts.size} matching records.`);
