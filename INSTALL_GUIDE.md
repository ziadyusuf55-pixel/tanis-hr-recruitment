# Tanis Hub — Feature Bundle (Logouts + Schedule Swap + HR Profile)

## What's in this bundle
| File | Feature |
|------|---------|
| `drizzle/schema.ts` | client_logouts + schedule_change_requests tables (source of truth) |
| `server/_core/index.ts` | **#2** `POST /api/upload/logouts` REST endpoint; **#6** celebrations = active-only |
| `server/db.ts` | logout + schedule-swap helpers |
| `server/routers.ts` | **#5** `listColleagues` + peer-reject notifies requester; **#1** profile now returns Recruitment + Payroll |
| `client/src/pages/AgentPortal.tsx` | **#5** agent Schedule-Swap screen (request + approve/decline) |
| `client/src/pages/AgentProfilePage.tsx` | **#1** avatar in header + Recruitment / Payroll / Commission tabs |
| `client/src/pages/Requests.tsx` | **#5** admin sees only peer-approved swaps |

## Ziad — how to deploy
1. Unzip and copy the `tanis-hr-recruitment-main` folder **over** your local repo clone (overwrite when asked).
2. Open **GitHub Desktop** → review the changed files → **Commit** → **Push** to `main`.
3. Hand Manus the prompts in `MANUS_PROMPTS.md` (also pasted in chat).

## No new environment variables are needed for this bundle.
(The logouts push reuses your existing sheet API key.)

## After deploy — turn on logouts from the sheet
In the admin Google Sheet: **🔄 Tanis Admin → Push Logouts to Hub**.
Each agent then sees their logouts in the portal under **Performance → Client Logouts**.
