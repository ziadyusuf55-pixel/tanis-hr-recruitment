# Manus prompts — run in order after Ziad pushes to GitHub

## Prompt 1 — Pull, migrate, redeploy
```
Pull the latest from the main branch of tanis-hr-recruitment.

Then sync the database schema to match drizzle/schema.ts (run the drizzle
migration / db push). This must idempotently ensure these exist:
  • table client_logouts (columns: id, crdts, agentCode, alias, date,
    cycleKey, uploadedAt, createdAt)
  • table schedule_change_requests (columns include status enum
    'pending_peer' | 'pending_manager' | 'approved' | 'rejected',
    peerApprovedAt, managerApprovedAt, managerComment, requesterNewOff1/2,
    targetNewOff1/2, message)
  • workforce_agents.avatarUrl and the personal-profile columns
    (nationalId, dateOfBirth, gender, nationality, maritalStatus,
    militaryStatus, jobTitle, city, profileLocked, workLocation)
If any already exist, leave them as-is. Do not drop or rename anything.

Then rebuild and redeploy the app. Confirm the build succeeds and report
any type errors.
```

## Prompt 2 — Smoke-test the new endpoint
```
After redeploy, verify POST https://hub.tanis-eg.com/api/upload/logouts
accepts an X-API-Key header and a JSON array like
[{"CRDTS":"114084","Date":"2026-05-25","Alias":"John"}]
and returns {"ok":true,"count":1}. Report the response.
```

## Prompt 3 — Add the top-level "HR" menu (needs the nav/layout file)
```
In the admin layout/sidebar nav component, add a new top-level item labelled
"HR" that opens the employees list (the same agents list used by Operations).
Clicking an employee should route to /operations/agents/:code — that page now
has Recruitment, Payroll, and Commission tabs plus the avatar header, so no
other change is needed there. Keep the existing Operations item as-is.
```
(If you'd rather I wire this myself, send me the nav/layout file — the one
that defines the Operations / Payroll / Requests menu items — and I'll add
the HR item directly.)

## Reminder (only if you still want Slack react-to-action from before)
SLACK_BOT_TOKEN (xoxb-…) and SLACK_ADMIN_CHANNEL_ID were still pending from
the earlier Slack batch. They are NOT required for anything in this bundle.
