-- 0015: Test / demo agent accounts for Quantum client
-- These agents are marked isDemo=TRUE so they are excluded from all real reports and headcount.
-- (No login credentials are seeded — see Step 3 note below.)
-- Trainee codes: QNT-TEST1, QNT-TEST2, QNT-TEST3
--
-- Prerequisites: a client named "Quantum" with at least one campaign must already exist.
-- The INSERT below uses a subquery to find the first Quantum campaign automatically.

-- ─── Step 1: Insert placeholder candidates (required by FK) ──────────────────
INSERT IGNORE INTO candidates (name, email, positionApplied, status)
VALUES
  ('Test Agent Quantum 1', 'qnt.test1@tanis-demo.internal', 'Scheduler', 'accepted'),
  ('Test Agent Quantum 2', 'qnt.test2@tanis-demo.internal', 'Receiving Service', 'accepted'),
  ('Test Agent Quantum 3', 'qnt.test3@tanis-demo.internal', 'Call Center Agent', 'accepted');

-- ─── Step 2: Insert demo workforce agents ────────────────────────────────────
-- Assigns to the first campaign belonging to the Quantum client.
INSERT IGNORE INTO workforce_agents
  (traineeCode, candidateId, campaignId, fullName, alias, agentStatus, nestingStatus, workLocation, isDemo, salarySettled, jobTitle)
VALUES
  (
    'QNT-TEST1',
    (SELECT id FROM candidates WHERE email = 'qnt.test1@tanis-demo.internal' LIMIT 1),
    (SELECT c.id FROM campaigns c INNER JOIN clients cl ON c.clientId = cl.id WHERE cl.name LIKE '%Quantum%' ORDER BY c.id LIMIT 1),
    'Test Agent Quantum 1',
    'QNT Demo 1',
    'active',
    'active',
    'office',
    TRUE,
    TRUE,
    'Scheduler'
  ),
  (
    'QNT-TEST2',
    (SELECT id FROM candidates WHERE email = 'qnt.test2@tanis-demo.internal' LIMIT 1),
    (SELECT c.id FROM campaigns c INNER JOIN clients cl ON c.clientId = cl.id WHERE cl.name LIKE '%Quantum%' ORDER BY c.id LIMIT 1),
    'Test Agent Quantum 2',
    'QNT Demo 2',
    'active',
    'active',
    'office',
    TRUE,
    TRUE,
    'Receiving Service'
  ),
  (
    'QNT-TEST3',
    (SELECT id FROM candidates WHERE email = 'qnt.test3@tanis-demo.internal' LIMIT 1),
    (SELECT c.id FROM campaigns c INNER JOIN clients cl ON c.clientId = cl.id WHERE cl.name LIKE '%Quantum%' ORDER BY c.id LIMIT 1),
    'Test Agent Quantum 3',
    'QNT Demo 3',
    'active',
    'active',
    'office',
    TRUE,
    TRUE,
    'Call Center Agent'
  );

-- ─── Step 3 (REMOVED in audit, Oct 2026) ─────────────────────────────────────
-- This file used to seed agent_credentials for the three demo agents with a shared,
-- documented password. Shared credentials on production are a takeover risk, and
-- isDemo accounts are now blocked from the live portal by server/_core/agentAuth.ts.
-- 0017 deletes any such rows that were already inserted. To test the portal, generate
-- a one-time password from Operations → agent → Generate Credentials.
