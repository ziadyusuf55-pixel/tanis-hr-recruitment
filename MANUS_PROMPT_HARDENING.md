# Deploy: Security hardening batch (authorization matrix + xlsx + credential audit)

Small follow-up to the one-batch deployment. **No migrations, no backups needed** — this is code + one dependency change.

## 1. Apply files

Overlay every file in the zip at the same repo-relative path:

```
client/src/pages/Operations.tsx
package.json
pnpm-lock.yaml
scripts/check-weak-passwords.mjs     (NEW — run `git add -f`, scripts/ is gitignored)
server/roleMatrix.test.ts            (NEW)
server/routers.ts
todo.md
```

**Delete** this file (dead test script containing a historical password):

```
test_agent_login.mjs
```

## 2. Install (dependency change)

```
pnpm install
```

This swaps `xlsx@0.18.5` (known prototype-pollution/ReDoS issues, unmaintained on npm) for the official patched SheetJS 0.20.3 build via the npm alias `@e965/xlsx`. All imports are unchanged.

## 3. Validate

```
pnpm exec tsc --noEmit -p tsconfig.json   # expect 0 errors
pnpm exec vitest run                      # expect 126 passed / 3 skipped (includes NEW 57-test role matrix)
pnpm run build
```

## 4. Deploy, then commit to GitHub

Deploy as usual and reply with the checkpoint SHA. When committing, remember `git add -f scripts/check-weak-passwords.mjs` (gitignored folder).

## 5. One-time credential audit (read-only, after deploy)

From the sandbox with the production DATABASE_URL:

```
node scripts/check-weak-passwords.mjs
```

It bcrypt-compares every agent login against the old shared default password and guessable variants. **It changes nothing** — it prints a list of trainee codes. Report the full output. If any accounts are listed, HR resets them from Training → Reset Password.

## 6. Smoke checks (2 minutes)

1. Hub loads; log in as an admin → Payroll page loads.
2. Operations → open an agent drawer → Documents and Payment sections render for admin.
3. Agent portal demo login still works.

## What changed (summary)

Backend authorization matrix tightened per the owner's role decisions (money/PII = finance+hr+managers; approvals include team leads): payroll reads, payroll month lists, payment methods, ID documents, comments/warnings, exit-checklist writes, CRDTS handover, former-agents money/PII, coaching bonus approval, performance writes. `incompleteProfiles` no longer ships PII values (only which fields are missing). A 57-assertion role-matrix test suite pins all of this so it cannot regress.
