# Tanis HR Recruitment ATS — TODO

## Phase 1: Database Schema & Design System
- [x] Define database schema: jobs, candidates, interviews tables
- [x] Generate and apply Drizzle migration SQL
- [x] Set up global design tokens (colors, typography, spacing) in index.css
- [x] Configure Google Font (Inter) in index.css

## Phase 2: Backend (tRPC Routers)
- [x] DB helpers for jobs CRUD
- [x] DB helpers for candidates CRUD + status pipeline
- [x] DB helpers for interviews
- [x] tRPC router: jobs (list, create, update, delete)
- [x] tRPC router: candidates (list, create, update, delete, updateStatus, import CSV)
- [x] tRPC router: interviews (schedule, get by candidate)
- [x] tRPC router: dashboard (pipeline counts per stage)
- [x] Email notification on interview schedule (built-in Forge API)

## Phase 3: Frontend Layout & Core Pages
- [x] Global DashboardLayout with sidebar navigation
- [x] Dashboard page with pipeline overview (counts per stage)
- [x] Job Postings page (list, create, edit, delete)
- [x] Candidates Pipeline page (Kanban-style board by status)

## Phase 4: Candidate Details & Advanced Features
- [x] Candidate profile detail page (all fields)
- [x] Add candidate manually (form)
- [x] Edit candidate profile
- [x] Interview scheduling UI (date/time picker)
- [x] CSV import UI (file upload, preview, confirm)
- [x] Email notification trigger on interview schedule

## Phase 5: Tests, Polish & Delivery
- [x] Vitest unit tests for key routers (19 tests passing)
- [x] UI polish: transitions, empty states, loading skeletons
- [x] Responsive design verification
- [x] Save checkpoint
- [x] Deliver to user

## Change Requests (Round 2)
- [x] Add Tanis logo to sidebar and apply Tanis brand colors (dark navy/teal theme)
- [x] Improve dashboard: add time-period filter (This Week / This Month / All Time) and contextual stats
- [x] Remove Job Postings tab — all candidates are call center agents, position is fixed
- [x] Fix CSV import: column 3 is phone number not position — set position to "Call Center Agent" for all imports
- [x] Rename "Offered" pipeline stage to "Team Invitation Sent" everywhere

## Change Requests (Round 3)
- [x] Upload white Tanis logo PNG to CDN
- [x] Update sidebar background color to match Tanis brand (dark red/maroon from logo)
- [x] Replace sidebar logo with white version
- [x] Fix phone number parsing: handle country codes (020, +20), parentheses, dashes, spaces
- [x] Rebuild pipeline stages: Applied → WhatsApp Sent → Voice Note Reviewed → Interview Scheduled → Accepted → Teams Invitation Sent (+ Rejected as universal exit)
- [x] Update DB schema: migrate candidates.status enum to new stages
- [x] Add stage_notes table: candidateId, stage, note, createdAt, recruiterName
- [x] Add tRPC router: notes (add, list by candidate)
- [x] Update dashboard to reflect new stage names and counts
- [x] Update Candidates pipeline board with new stages and colors
- [x] Update CandidateDetail: new stage stepper, per-stage notes UI, Teams link field, Meet link field
- [x] Update CSV import: remove position field requirement, fix phone parsing

## Change Requests (Round 3 — Full Rebuild)
- [x] Update DB schema: new pipeline enum (applied, whatsapp_sent, voice_note_reviewed, interview_scheduled, accepted, teams_invitation_sent, rejected)
- [x] Add stage_notes table (id, candidateId, stage, note, recruiterName, createdAt)
- [x] Run Drizzle migration for schema changes
- [x] Update DB helpers: getPipelineCounts, getKPIStats (time-to-hire, conversion, drop-off per stage)
- [x] Update tRPC routers: candidates (new stages), notes (add, list), dashboard (full KPI stats)
- [x] Update pipeline.ts constants with new 6 stages + colors
- [x] Update sidebar: dark red background (#8B1A1A or Tanis brand red), white logo CDN URL
- [x] Update Dashboard: 4 KPI cards + funnel bar chart + rejection breakdown
- [x] Update Candidates board: new stage columns with correct colors
- [x] Update CandidateDetail: new stage stepper, per-stage notes panel, Meet link + Teams link fields
- [x] Fix phone parsing: handle 020, +20, parentheses, dashes, spaces in CSV import
- [x] Update Vitest tests for new pipeline stages

## Change Requests (Round 4)
- [x] Add delete button on candidate cards (board view) with confirmation dialog
- [x] Add delete button on candidate rows (list view) with confirmation dialog

## Change Requests (Round 5)
- [x] Multi-select candidates in list and board views with bulk delete action
- [x] CSV format: required columns are name + phone only (email optional, all others optional)
- [x] Manual add form: phone mandatory, email optional, remove resume link field

## Change Requests (Round 6)
- [x] Make Tanis logo bigger in sidebar
- [x] Fix firm name from "TANIS" to "Tanis" in sidebar

## Change Requests (Round 7)
- [x] WhatsApp quick-copy button on candidate cards (board + list) — pre-fills intro message with name and phone
- [x] Bulk stage move — extend multi-select bar with "Move to Stage" dropdown
- [x] Rejection reason — prompt for reason (No-show, Withdrew, Underqualified, Other) when moving to Rejected

## Change Requests (Round 8)
- [x] Add "Skip to Interview" button on candidate board cards (visible for Applied, WhatsApp Sent, Voice Note Reviewed stages)
- [x] Add "Skip to Interview" button on candidate list rows (same stage condition)
- [x] Add "Skip to Interview" shortcut on candidate detail page pipeline stepper

## Change Requests (Round 9)
- [x] Backend: checkDuplicate procedure — lookup by phone, return existing candidate info + stage + rejection notes
- [x] Backend: getReApplicants query — candidates whose phone matches a previously rejected candidate
- [x] Frontend: manual add form — real-time phone duplicate check with warning card showing existing candidate stage and rejection history
- [x] Frontend: CSV import — flag duplicate rows with warning, show existing candidate info, allow skip or force-import per row
- [x] Frontend: Candidates page — add "Re-applicants" filter tab showing candidates who applied more than once

## Change Requests (Round 10 — Rich Candidate Profile)
- [x] DB schema: add age, location, source, voiceNoteRating, resumeLink fields to candidates table
- [x] DB schema: add activity_log table (id, candidateId, action, fromStage, toStage, performedBy, createdAt)
- [x] Run migration for new schema fields
- [x] Backend: update createCandidate and updateCandidate helpers to handle new fields
- [x] Backend: add logActivity helper to record stage changes and key actions
- [x] Backend: update updateStatus procedure to auto-log activity on every stage change
- [x] Backend: add activity.listByCandidate tRPC procedure
- [x] Frontend: rebuild CandidateDetail with Personal Info section (age, location, source, resumeLink)
- [x] Frontend: add Screening Results section (voice note rating 1-5 stars + screening comments)
- [x] Frontend: add Activity Timeline section showing full stage change history with timestamps
- [x] Frontend: update manual add form to include source, age, location fields
- [x] Frontend: update edit form to include all new fields
- [x] Frontend: update CSV import to optionally map source column

## Change Requests (Round 11)
- [x] Add "No Show" quick-action button to candidate board cards (visible for Interview Scheduled stage)
- [x] Add "No Show" quick-action button to candidate list rows (same stage condition)
- [x] Add "No Show" button to CandidateDetail page pipeline stepper / action bar
- [x] No Show action: rejects candidate with pre-filled reason "No-show — Did not attend interview", still requires confirmation
- [x] Make rejection reason a required free-text field (not a dropdown, not optional) in single reject dialog
- [x] Make rejection reason required in bulk reject dialog
- [x] Disable "Confirm Rejection" button until reason is filled in (both single and bulk)
- [x] Update CandidateDetail rejection flow to also require a reason

## Change Requests (Round 12 — Wave Categorization)
- [x] DB schema: add wave field (nullable integer, e.g. 1, 2, 3...) to candidates table
- [x] Run Drizzle migration for wave field
- [x] Backend: update createCandidate, updateCandidate, bulkInsertCandidates to accept wave
- [x] Backend: update tRPC create/update/bulkImport input schemas to include optional wave
- [x] Frontend: add Wave field (number input or select) to Add Candidate form
- [x] Frontend: add Wave field to CandidateDetail edit form
- [x] Frontend: show Wave badge on candidate board cards and list rows
- [x] Frontend: add Wave filter dropdown on Candidates page toolbar
- [x] Frontend: update CSV import to parse optional wave column

## Change Requests (Round 13)
- [x] Add "WhatsApp Sent" quick-action button to board cards (visible for Applied stage)
- [x] Add "Interview Scheduled" quick-action button to board cards (visible for Voice Note Reviewed stage)
- [x] Add "WhatsApp Sent" quick-action button to list rows (same stage condition)
- [x] Add "Interview Scheduled" quick-action button to list rows (same stage condition)
- [x] Backend: add uploadCv tRPC mutation to handle CV file upload to S3 and save URL on candidate
- [x] DB: add cvUrl and cvFileName columns to candidates table
- [x] Run migration for cvUrl and cvFileName columns
- [x] Frontend: add CV Attachment section to CandidateDetail (upload button, file name, download/preview link)
- [x] Frontend: CV upload shows file name and a clickable link to open/download the file

## Change Requests (Round 14 — Phone Search Suffix Matching)
- [x] Fix candidate search: phone matching should use last 8 digits suffix so "03424945" matches "01003424945"
- [x] Apply same suffix logic to the search bar in both board view and list view

## Change Requests (Round 15 — Pipeline + Training)
- [x] Remove "Re-applicants" filter tab from Candidates page
- [x] Add "Rejected" as a visible column in the Kanban pipeline board
- [x] DB schema: add training_batches table (id, name, trainerName, startDate, notes, createdAt)
- [x] DB schema: add batch_candidates table (id, batchId, candidateId, assignedAt)
- [x] Run migration for training_batches and batch_candidates
- [x] Backend: tRPC batches.create (name, trainerName, startDate, notes)
- [x] Backend: tRPC batches.list (all batches with candidate count)
- [x] Backend: tRPC batches.getById (batch details + assigned candidates)
- [x] Backend: tRPC batches.assignCandidate (batchId, candidateId)
- [x] Backend: tRPC batches.removeCandidate (batchId, candidateId)
- [x] Backend: tRPC batches.delete (batchId)
- [x] Frontend: add Training page in sidebar navigation
- [x] Frontend: Training page — list of batches as cards (name, trainer, start date, candidate count)
- [x] Frontend: Training page — create new batch dialog (name, trainer name, start date, notes)
- [x] Frontend: Training page — batch detail view showing all assigned candidates
- [x] Frontend: Training page — assign candidate to batch (search accepted candidates and add)
- [x] Frontend: Training page — remove candidate from batch
- [x] Frontend: Candidate detail page — show which batch the candidate is assigned to (if any)

## Change Requests (Round 16 — Tanis Hub + Trainee Code + Timeline + Rejected Column)
- [x] Rename system: update app title to "Tanis Hub" in sidebar, login page, and page title
- [x] DB: add traineeCode column to batch_candidates table
- [x] Run migration for traineeCode column
- [x] Backend: add setTraineeCode tRPC procedure (batchId, candidateId, code)
- [x] Frontend: Training batch detail — show trainee code column, allow trainer to assign/edit code per agent
- [x] Frontend: Candidates page — add Timeline view tab (chronological list of all activity log entries across all candidates)
- [x] Frontend: Fix duplicate-key React warning from "rejected" appearing in both ACTIVE_STAGES and pipeline board
- [x] Mark Round 15 items as completed

## Change Requests (Round 17)
- [x] Candidates page: add "Show Rejected" quick-filter button in toolbar that instantly filters to rejected candidates only (toggleable, highlighted when active)
- [x] Training page: restrict "Assign Agent" dialog to only show candidates with status = teams_invitation_sent (not all accepted)
- [x] Backend: add tRPC query to get all batch assignments (candidateId → batchName) so candidate cards can show batch indicator
- [x] Candidates board cards: show a small batch badge (e.g. "Batch 1") if the candidate is assigned to a training batch
- [x] Candidates list rows: show the same batch badge in the row

## Change Requests (Round 18 — CSV Import Fix)
- [x] CSV parser: make phone optional — only skip rows where name is missing (not phone)
- [x] CSV parser: fix email validation in tRPC router to accept empty/missing emails gracefully
- [x] CSV parser: improve error messages so recruiter knows exactly what went wrong
- [x] CSV parser: handle rows where email is invalid format without crashing the whole import

## Change Requests (Round 19)
- [x] Add "blacklisted" as a valid pipeline status in pipeline.ts (STAGE_LABELS, STAGE_COLORS)
- [x] DB schema: update candidates status enum to include "blacklisted"
- [x] Backend: allow blacklisted as a valid status in updateStatus procedure
- [x] Frontend: add Blacklist button/option on candidate detail action bar
- [x] Frontend: show Blacklisted column in the pipeline board
- [x] Frontend: show blacklisted candidates in the Rejected quick-filter view
- [x] Remove Timeline view tab from the Candidates page toolbar

## Round 21 — Bug Fixes + No Answer Status
- [x] Fix routers.ts: rename stale `teams_invitation_sent` key to `whatsapp_group_added` in KPI stageCounts
- [x] Fix routers.ts: `whatsappGroupAdded` KPI card (was `teamsInvitationsSent`)
- [x] Fix getPipelineCounts: rejected/blacklisted counts should always be all-time (not filtered by period)
- [x] Fix Dashboard.tsx: rename FUNNEL_COLORS key from `teams_invitation_sent` to `whatsapp_group_added`
- [x] DB: add `no_answer` to candidates status enum (confirmed in DB — done in Round 23)
- [x] Run migration to add no_answer to DB enum (done in Round 23 via migration endpoint)
- [x] Backend: allow `no_answer` as valid status in updateStatus procedure (PIPELINE_STAGES_ZOD updated in Round 23)
- [x] Update pipeline.ts: add `no_answer` to STAGE_LABELS, STAGE_COLORS (using subStatus approach)
- [x] Frontend: add "No Answer" quick-action button on board cards (using subStatus)
- [x] Frontend: add "No Answer" quick-action button on list rows (using subStatus)
- [x] Frontend: add "No Answer" option on CandidateDetail action bar
- [x] Frontend: show "No Answer" badge on candidate cards
- [x] Update Vitest tests for no_answer stage

## Round 22 — Agent Portal + Welcome Screen + Performance Tab

- [x] DB: create agent_credentials table (candidateId FK, traineeCode, passwordHash, generatedAt)
- [x] DB: create payroll_records table (candidateId, month, grossSalary, deductions, netPay, paymentDate, status, notes)
- [x] DB: create performance_records table (candidateId, period, callsMade, leadsGenerated, targetsHit, qualityScore, attendanceRate, notes)
- [x] Backend: agentLogin procedure (traineeCode + password → JWT session cookie)
- [x] Backend: agentMe procedure (returns agent profile from session)
- [x] Backend: generateAgentCredentials procedure (auto-generate password, hash it, store, return plain text once)
- [x] Backend: payroll CRUD procedures (getPayroll, upsertPayrollRecord)
- [x] Backend: performance CRUD procedures (getPerformance, upsertPerformanceRecord)
- [x] Frontend: Welcome screen — two login cards (Admin OAuth + Agent Trainee ID/Password)
- [x] Frontend: Agent portal layout with sidebar (Profile, Training, Payroll tabs)
- [x] Frontend: Agent Profile tab — name, trainee ID, position, location, join date
- [x] Frontend: Agent Training tab — batch info, attendance, trainer notes
- [x] Frontend: Agent Payroll tab — monthly records table (read-only for agent)
- [x] Frontend: Admin CandidateDetail — "Generate Credentials" button shows password once
- [x] Frontend: Admin CandidateDetail — Performance tab (admin can add/edit monthly records)
- [x] Write vitest tests for agent auth and payroll procedures (10 new tests, 40 total)

## Round 24 — Login Portal Redesign

- [x] Redesign Login.tsx with a premium, branded full-screen layout
- [x] Add Google Fonts (Sora display font) to index.html
- [x] Ensure all 3 modes (welcome, admin, agent) have polished UI
- [x] Keep all existing logic intact (OAuth admin, agent JWT login)
- [x] 40/40 tests still passing

## Round 25 — Slack Joined Button in Training

- [x] DB: add `slackJoined` boolean column to `batchCandidates` table
- [x] Run migration SQL to add the column (via webdev_execute_sql)
- [x] Backend: add `toggleSlackJoined` tRPC mutation
- [x] Frontend: add Slack Joined toggle button per agent row in Training batch detail
- [x] 40/40 tests passing

## Round 26 — Request Center + Agent Login Fix + Pipeline Column Hide

- [x] DB: create `agent_requests` table (candidateId, traineeCode, type, subject, message, status, adminReply, createdAt, updatedAt)
- [x] Run migration SQL to create the table (migrate-agent-requests.mjs)
- [x] Backend: requestsRouter — submit (agent), listMine (agent), listAll (admin), updateStatus+reply (admin)
- [x] Request types: Leave/Day off, Salary inquiry, Schedule change, General complaint, Other
- [x] Request statuses: Pending, In Progress, Resolved, Rejected
- [x] Admin can reply with a message visible to the agent
- [x] Notify admin (notifyOwner) when a new request is submitted
- [x] Frontend (Agent Portal): new Requests tab — submit form + list own requests with status badges + admin reply visible
- [x] Frontend (Admin): new Requests page in sidebar (Inbox icon) — stats cards, request list, detail dialog
- [x] Fix agent login: only 1 credential exists (T-5555); credentials must be generated per agent from Training batch detail
- [x] Pipeline board: EyeOff button per column header — click to collapse to narrow strip, click again to expand
- [x] 40/40 tests passing

## Round 27 — Multi-Admin, Security, Referrals, Notifications, Analytics

### Multi-Admin System
- [x] DB: create `admin_accounts` table (id, email, passwordHash, name, role, isActive, forcePasswordChange, createdAt)
- [x] DB: create `admin_invites` table (id, email, token, expiresAt, usedAt, invitedBy)
- [x] Run migration for admin_accounts and admin_invites (migrate-round27.mjs)
- [x] Backend: adminAuth.invite procedure (owner only — send invite, store token with 48h expiry)
- [x] Backend: adminAuth.acceptInvite procedure (validate token, set password, create account)
- [x] Backend: adminAuth.login procedure (email + password → JWT session, rate-limited)
- [x] Backend: adminAuth.listAdmins procedure (owner only)
- [x] Backend: adminAuth.deactivateAdmin procedure (owner only)
- [x] Security: bcrypt hash all admin passwords
- [x] Security: rate limit agent login — 5 failed attempts → 15-min lockout (login_attempts table)
- [x] Security: invite tokens expire in 48 hours
- [x] Security: force password change on first login flag
- [x] Frontend: Login page — add "Admin (Email)" login mode alongside Manus OAuth
- [x] Frontend: Settings → Admins page — list admins, invite by email, deactivate button
- [x] Frontend: AdminInviteAccept page at /admin/accept-invite?token=...

### Request Center Upgrades
- [x] Add "Resignation" request type with last working day date picker (min 2 weeks from today)
- [x] Add "Day Off" request type with requested date picker (min 2 weeks from today)
- [x] Update all date-based request types to enforce 2-week minimum on frontend + backend
- [x] Backend: update requestsRouter to handle requestedDate field
- [x] DB: add requestedDate column to agent_requests table (migrate-round27b.mjs)

### Referral Tab
- [x] DB: create `referrals` table (id, referrerCandidateId, refereeName, refereePhone, refereeNote, status, createdAt)
- [x] Run migration for referrals table (migrate-round27.mjs)
- [x] Backend: referrals.submit (agent submits referral, auto-creates candidate with source=referred)
- [x] Backend: referrals.listMine (agent sees own referrals + status)
- [x] Backend: referrals.listAll (admin sees all referrals)
- [x] Frontend (Agent Portal): new Referrals tab — submit form + list own referrals with status
- [x] Frontend (Admin): referral candidates show "Referred" source label in pipeline

### Request Analytics Panel
- [x] Frontend (Admin Requests page): summary panel — total by type, avg resolution time, pending/resolved/rejected counts

### Bulk Credential Generation
- [x] Backend: batches.bulkGenerateCredentials procedure (generate for all agents in batch with trainee codes)
- [x] Frontend (Training batch detail): "Generate All Credentials" button with copy-per-row and "Copy All" dialog

### Agent Notification Bell
- [x] DB: create `agent_notifications` table (id, candidateId, message, isRead, createdAt)
- [x] Run migration for agent_notifications (migrate-round27.mjs)
- [x] Backend: notify agent when admin replies to request
- [x] Backend: notifications.listMine (agent) + markRead
- [x] Frontend (Agent Portal): notification bell in header — unread count badge, dropdown list

- [x] 40/40 tests passing

## Round 28 — Agent Password Reset

- [x] Backend: add `agent.resetPassword` procedure (admin only) — generates new random password, bcrypt hashes it, updates agent_credentials, returns plain password
- [x] Frontend (Training batch detail): amber RotateCcw button per agent row — shows new password in a copy dialog (shown only once)
- [x] 40/40 tests passing

## Round 29 — Bug Fix: Agent Login Cookie Name Mismatch

- [x] Root cause found: `requests.submit` and `requests.listMine` used hardcoded `agent_session` cookie name instead of the `AGENT_COOKIE` constant (`tanis_agent_session`) — caused agent request submissions to fail with UNAUTHORIZED even after successful login
- [x] Fixed both procedures to use `ctx.req.cookies?.[AGENT_COOKIE]`
- [x] 40/40 tests still passing

## Round 29b — Deep Fix: Agent Cookie Not Parsed (req.cookies undefined)

- [x] Root cause: Express has no `cookie-parser` middleware, so `req.cookies` is always `undefined`. All 5 agent cookie reads used `ctx.req.cookies?.[AGENT_COOKIE]` which always returned `undefined` — login appeared to succeed but agent.me always returned null, causing immediate redirect back to login
- [x] Fix: Added `getAgentCookieFromReq()` helper that parses `req.headers.cookie` directly using the `cookie` package (already installed), same approach used by the SDK
- [x] Replaced all 5 `ctx.req.cookies?.[AGENT_COOKIE]` calls with `getAgentCookieFromReq(ctx.req)`
- [x] Also aligned agent login cookie options to use `getSessionCookieOptions()` (sameSite:none, secure based on x-forwarded-proto) matching the OAuth cookie approach — ensures cookies work on HTTPS deployed site
- [x] End-to-end test confirmed: login returns 200 + sets cookie, agent.me returns full agent profile
- [x] 40/40 tests passing

## Round 30 — Agent Portal Redesign + Request Center Improvements

- [x] Backend: fix join date to use batch `assignedAt` (when agent was assigned to training batch) instead of candidate `createdAt`
- [x] Backend: add `sick_note` to request type enum in DB and Zod schema
- [x] Backend: add `attachmentUrl` and `isAdminRead` columns to `agent_requests` table
- [x] Backend: add `requests.uploadAttachment` tRPC mutation (upload file to S3, return URL)
- [x] Backend: fix 2-week date validation — use calendar days (allow same day 14 days from now)
- [x] Backend: remove `notifyOwner` email call from `requests.submit`
- [x] Backend: add `requests.countUnread`, `requests.markAllRead` tRPC procedures
- [x] Frontend: redesign AgentPortal with new dark layout (top nav, hero banner, card sections)
- [x] Frontend: remove Training tab from agent portal
- [x] Frontend: fix join date display to show batch `assignedAt` date
- [x] Frontend: add `sick_note` option to request type dropdown
- [x] Frontend: add file attachment input on request form (any file type, upload to S3 via tRPC)
- [x] Frontend: multi-day calendar picker for leave/day-off requests
- [x] Frontend: add unread requests red dot badge on admin sidebar "Requests" nav item
- [x] Admin Requests page: mark all as read on open, show attachment link and multi-day dates in detail dialog
- [x] 40/40 tests still passing

## Round 31 — Agent Portal Light/Dark Mode Toggle

- [x] Add light/dark mode toggle button in agent portal top bar (sun/moon icon)
- [x] Persist preference in localStorage (key: tanis-agent-theme, default: dark)
- [x] Full light theme: white/stone background, dark text, brand accent colors
- [x] 40/40 tests passing

## Round 32 — No Answer Pipeline Stage

- [x] DB: 'no_answer' was already in the status enum (added in a previous round)
- [x] Backend: schema.ts and routers.ts already had no_answer in PIPELINE_STAGES_ZOD
- [x] Backend: fixed dashboard KPI to count no_answer from pipelineCounts (status column) instead of legacy subStatus
- [x] Frontend: updated pipeline.ts to add no_answer stage with orange color, labels, and descriptions
- [x] Frontend: fixed No Answer button to call updateStatus (moves to no_answer stage) instead of setSubStatus
- [x] Frontend: No Answer column now appears in board; button shows on whatsapp_sent cards; back button on no_answer cards
- [x] Frontend: Skip to Interview shortcut also available from no_answer stage
- [x] 40/40 tests still passing

## Round 33 — Workforce Operations Module (COMPLETED)

### DB Schema
- [x] Add `campaigns` table (id, name, minHeadcount, workDays: all/weekdays)
- [x] Add `workforce_agents` table (id, traineeCode, fullName, alias, email, phone, campaignId, joinDate, shiftHours, teamLeader, offDay1, offDay2, preferredPaymentMethod)
- [x] Add `agent_payment_methods` table (id, agentCode, type: wallet/bank, walletProvider, walletPhone, walletName, bankName, bankAccountOrPhone, bankFullName, isPreferred, adminComment)
- [x] Add `agent_documents` table (id, agentCode, docType, fileUrl, status: pending/approved/rejected, adminComment, uploadedAt)
- [x] Add `schedule_change_requests` table (id, requesterCode, targetCode, requesterNewOff1/2, targetNewOff1/2, status, peerApprovedAt, managerComment)
- [x] Add `overtime_availability` table (id, agentCode, date, status: available/unavailable)
- [x] Run migration SQL for all new tables

### Backend Routers
- [x] `workforce.list` — admin lists all ops agents
- [x] `workforce.create` — admin adds agent to operations
- [x] `workforce.update` — admin edits agent fields
- [x] `workforce.getMyProfile` — agent reads own ops profile
- [x] `campaigns.list/create/update` — manage campaigns
- [x] `campaigns.headcountForecast` — projected daily count per campaign for next 30 days
- [x] `campaigns.sendOvertimeAlert` — send bell notification to all campaign agents off that day
- [x] `paymentMethods.upsert` — agent adds/edits payment method
- [x] `paymentMethods.listMine` — agent lists own payment methods
- [x] `paymentMethods.listAll` — admin sees all
- [x] `paymentMethods.addComment` — admin comments on a payment method
- [x] `documents.upload` — agent uploads doc to S3
- [x] `documents.listMine` — agent sees own docs
- [x] `documents.listAll` — admin sees all
- [x] `documents.review` — admin sets status + comment
- [x] `scheduleChange.request` — agent submits swap request
- [x] `scheduleChange.peerApprove` — target agent approves/rejects
- [x] `scheduleChange.managerApprove` — admin approves/rejects, updates off days
- [x] `scheduleChange.listMine` — agent sees own requests
- [x] `scheduleChange.listAll` — admin sees all

### Admin UI
- [x] Training tab: remove Slack invitation button, convert to list view (name, batch, mock status, quick-edit), remove Trainee ID column
- [x] Add Operations tab in admin sidebar
- [x] Operations: agent list view (name, ID, campaign, shift, team leader, off days, Teams button)
- [x] Operations: add/edit agent dialog (all fields including campaign, shift, off days, team leader)
- [x] Operations: Campaign management section (create/edit campaigns, set min headcount, work days)
- [x] Operations: Headcount forecast view — weekly/monthly calendar per campaign, red days = below minimum
- [x] Operations: "Send Overtime Alert" button on below-minimum days
- [x] Operations: Documents review panel per agent (doc list, status badges, comment input)
- [x] Operations: Payment methods review panel (see all methods, add admin comments)

### Agent Portal
- [x] Fix login: show "T-" as fixed prefix, agent types only number (e.g. 001 → T-001)
- [x] Dashboard: show campaign, join date, agent ID, off days, shift hours, team leader, alias, credentials
- [x] Remove Training Batch / Trainee ID labels (replaced by ops fields)
- [x] Payment method section: add wallet (Vodafone Cash/Orange Cash + phone + name) or bank (Egypt banks list + account/phone + full name), mark preferred, see admin comments
- [x] Documents section: upload required docs with Arabic instructions, see per-doc status + admin comment
- [x] Operation plan view: read-only schedule showing campaign weekly grid
- [x] Schedule change request: pick target agent, choose new off days for both, submit → peer approval → manager approval
- [x] Overtime availability: agent sees overtime notification and clicks Available/Not Available

## Round 34 — Operation Plan Grid, HR Letter, Portal Cleanup, Login Lockout

### Backend
- [x] Add `hr_letter` to agent_requests type enum (purpose + language: Arabic/English fields)
- [x] Fix WhatsApp group member deletion cascade: when deleted from group AND assigned to batch, remove from batch too
- [x] Add `workforce.getOperationPlan` procedure: dynamic grid — campaigns as sections, agents as columns, days as rows, 1=working 0=off, daily count
- [x] Fix Operations tab agent dropdown: show trainees (passed mock call) + existing operations agents
- [x] Add login lockout: 5 wrong attempts → 15-min lockout, show warning from attempt 3, lockout countdown message

### Admin
- [x] Operations tab: build dynamic operation plan grid view matching Excel format
- [x] Operations tab: agent dropdown shows trainees + existing ops agents

### Agent Portal
- [x] Remove "Training Batch" label → show Campaign number instead
- [x] Add off days display in profile (from workforce_agents.offDays)
- [x] Add manager name in profile (from workforce_agents.teamLeader)
- [x] Rename "Trainee ID" → "Agent ID" everywhere in portal
- [x] Remove "Schedule" tab entirely from agent portal
- [x] Keep schedule change request flow: pick swap partner → peer approves → manager approves
- [x] Add HR Letter to request type dropdown (purpose + language fields)
- [x] Login lockout UI: warning after 3 wrong attempts, lockout countdown after 5

- [x] 40/40 tests still passing

## Round 35 — Fix Add-Agent-to-Operations + Campaign Assignment Notifications
### Bug Fix
- [x] Diagnose why adding an agent to Operations is broken (Operations page add flow)
- [x] Fix the add-agent-to-Operations flow end-to-end
### Notifications
- [x] DB schema: add agent_notifications table (id, candidateId, type, title, body, isRead, createdAt)
- [x] Run migration for agent_notifications table
- [x] Backend: trigger notification when workforce_agents record is created/updated with a campaign
- [x] Backend: tRPC notifications.listMine — list unread + recent notifications for logged-in agent
- [x] Backend: tRPC notifications.markRead — mark one or all as read
- [x] Frontend: bell icon in agent portal header with unread badge count
- [x] Frontend: notification dropdown/panel listing campaign assignment alerts
- [x] Frontend: auto-poll or invalidate notifications on portal load
- [x] 40/40 tests still passing

## Round 36 — Admin Agent Profile Page
- [x] DB: create agent_comments table (id, traineeCode, adminName, content, tag: warning/note/resolved, createdAt)
- [x] DB: migrate agent_comments table
- [x] Backend: getAgentFullProfile procedure (workforce agent + documents + payment methods + comments)
- [x] Backend: addAgentComment mutation (admin only)
- [x] Backend: deleteAgentComment mutation (admin only)
- [x] Backend: updateAgentPaymentMethod mutation (admin can edit agent payment preferences)
- [x] Backend: getMyAdminComments procedure for agent portal (agent reads their own comments)
- [x] Frontend: /operations/agents/:code route + AgentProfilePage component
- [x] Frontend: AgentProfilePage — Profile header (name, code, campaign, shift, team leader, status)
- [x] Frontend: AgentProfilePage — Documents tab (view-only list of uploaded docs)
- [x] Frontend: AgentProfilePage — Payment Preferences tab (editable by admin)
- [x] Frontend: AgentProfilePage — Comments/Issues tab (add/delete comments with tag)
- [x] Frontend: Operations Agents tab — make agent rows clickable → navigate to profile page
- [x] Frontend: Agent portal — new "Comments" tab showing admin comments
- [x] 40/40 tests still passing

## Round 37 — Hub Adjustments
- [x] DB: Add `credentials` (text) column to workforce_agents table
- [x] DB: Add `phone`, `email` columns to workforce_agents table (auto-filled from candidate on create)
- [x] DB: Add `mustChangePassword` (boolean, default true) column to workforce_agents table
- [x] DB: Split request type: keep `off_day` (unpaid), add `paid_leave` type
- [x] Backend: workforce.create — auto-copy phone+email from candidate, set mustChangePassword=true
- [x] Backend: agent.login — return mustChangePassword flag in session
- [x] Backend: agent.changePassword — new mutation to update password and set mustChangePassword=false
- [x] Frontend: Add/Edit Agent form — add Credentials field (single text input)
- [x] Frontend: Agent portal — update login hint text to Tanis IT department message
- [x] Frontend: Agent portal — force password change screen on first login
- [x] Frontend: Agent portal — remove Training Info section from Profile tab
- [x] Frontend: Request Center — split Off Day (unpaid) and Paid Leave (paid) as separate request types
- [x] Frontend: Operation Plan — monthly calendar grid view replacing week arrows
- [x] Frontend: Schedule Change flow — full peer-approve + admin-approve flow
- [x] 40/40 tests still passing

## Round 39 — Restore Op Plan, Headcount Alert, Bulk Credentials
- [x] Restore Operation Plan to previous week-based arrows view (rollback calendar)
- [x] Wire Headcount Forecast alert button to send Manus notification when headcount < minimum
- [x] Add bulk credential generation: generate Tanis2025 password for all agents without credentials, export CSV (name, code, password)
- [x] Add "Add Agent" button to Operations Agents tab header
- [x] 40/40 tests still passing

## Round 40 — Payroll Module
- [x] DB: Migrated `payroll_records` table to add agentCode, baseSalary, workingHours, overtimeHours, commission, uploadedBy, uploadedAt columns
- [x] Backend: payroll.uploadPayroll mutation — parse rows, upsert per agent per month (admin only)
- [x] Backend: payroll.getPayrollMonths query — distinct uploaded months (admin)
- [x] Backend: payroll.getPayrollByMonth query — all agent records for a given month (admin)
- [x] Backend: payroll.getMyPayrollMonths query — agent gets their months
- [x] Backend: payroll.getMyPayrollRecord query — agent gets their record for a given month
- [x] Frontend: Added "Payroll" to admin sidebar navigation (Banknote icon)
- [x] Frontend: Admin Payroll page — month selector with arrows
- [x] Frontend: Admin Payroll page — table of all agents' payroll for selected month
- [x] Frontend: Admin Payroll page — Upload button with Excel file picker, parse preview, confirm upload
- [x] Frontend: Admin Payroll page — Download Template button (generates blank Excel template)
- [x] Frontend: Agent portal Payroll tab — replaced old tab with new Excel-based tab
- [x] Frontend: Agent portal Payroll tab — month selector (only uploaded months)
- [x] Frontend: Agent portal Payroll tab — payroll breakdown card (base salary, hours, overtime, commission, deductions, net pay)
- [x] 40/40 tests still passing

## Round 41 — Break Schedule + Agent Portal Profile Updates
- [x] DB: Created `break_schedules` table (agentCode, date, breakStart, breakEnd, unique on agentCode+date)
- [x] Backend: breakSchedule.upsert mutation — admin upserts break entries for an agent (bulk)
- [x] Backend: breakSchedule.getByAgent query — admin gets all breaks for an agent in a date range
- [x] Backend: breakSchedule.getByDateRange query — admin overview of all breaks in a range
- [x] Backend: breakSchedule.delete mutation — admin deletes a specific break entry
- [x] Backend: breakSchedule.getMyBreaks query — agent gets their own breaks for current week
- [x] Frontend: Operations tab — added "Break Schedule" sub-tab (Clock icon)
- [x] Frontend: Break Schedule tab — campaign selector → agent selector (filtered by campaign)
- [x] Frontend: Break Schedule tab — week navigator (arrows + week label)
- [x] Frontend: Break Schedule tab — day-by-day grid with time pickers (12-hour preview column)
- [x] Frontend: Break Schedule tab — Quick Fill: set one time and apply to all days in week
- [x] Frontend: Break Schedule tab — override individual days manually, delete individual entries
- [x] Frontend: Break Schedule tab — loads existing saved breaks when agent/week changes
- [x] Frontend: Agent Portal Profile tab — added Campaign card
- [x] Frontend: Agent Portal Profile tab — added Day Offs card (from wfProfile offDay1/offDay2)
- [x] Frontend: Agent Portal Profile tab — added This Week's Break Schedule card (12h format)
- [x] All times displayed in 12-hour format (e.g., 2:00 PM) in UI
- [x] 40/40 tests passing, 0 TypeScript errors

## Round 42 — Multiple Breaks Per Day
- [x] DB: Dropped old unique constraint (agentCode, date), added new unique on (agentCode, date, breakIndex)
- [x] DB: Added breakIndex column to break_schedules table
- [x] Backend: Updated upsert (bulkReplaceBreaks) — replaces all slots for a date, inserts with sequential breakIndex
- [x] Frontend: Break Schedule tab — day-by-day cards, each showing all break slots as table rows
- [x] Frontend: Break Schedule tab — "Add Break" button per day header adds a new empty row
- [x] Frontend: Break Schedule tab — delete (trash) button per individual break row
- [x] Frontend: Break Schedule tab — Quick Fill appends one slot to all 7 days (preserves existing)
- [x] Frontend: Agent Portal Profile tab — groups multiple breaks per day, shows numbered list per day card
- [x] 40/40 tests passing, 0 TypeScript errors

## Round 43 — Edit Agent Form Cleanup + Resignation & Termination
- [x] DB: Added `crdts` column to workforce_agents table
- [x] DB: Added `agentStatus` column to workforce_agents (resigned, terminated, or null)
- [x] DB: Created `agent_separations` table (agentCode, type, reason, lastWorkingDay, requestedAt, effectiveAt, approvedBy, approvedAt)
- [x] Backend: Updated updateWorkforceAgent to include crdts field; added crdts to workforce.update router
- [x] Backend: separation.resignOnSpot mutation — sets resigned, blacklists candidate, revokes portal access, stores record
- [x] Backend: separation.terminate mutation — sets terminated, revokes portal access, stores record
- [x] Backend: separation.approveResignation mutation — approves resignation request, sets resigned, revokes access, stores record, marks request resolved
- [x] Backend: separation.getByAgent query — get separation history for an agent
- [x] Backend: getAgentRequestById helper added to db.ts
- [x] Frontend: Edit Agent dialog — removed Email, Phone, Shift Hours fields; added CRDTS text field
- [x] Frontend: Agent list — Resigned (red) / Terminated (orange) badges distinct from Active/Inactive
- [x] Frontend: AgentDetailDialog — "Mark Resigned (On Spot)" and "Terminate Agent" buttons (hidden if already separated)
- [x] Frontend: AgentDetailDialog — on-spot resignation confirmation dialog with required reason
- [x] Frontend: AgentDetailDialog — termination confirmation dialog with required reason
- [x] Frontend: Request Center (agent portal) — Resignation request already existed with 2-week minimum date enforcement
- [x] Frontend: Admin Requests tab — "Approve Resignation" button for pending/in-progress resignation requests
- [x] 40/40 tests passing, 0 TypeScript errors

## Round 43 Bug Fix — CRDTS Not Saving
- [x] Fix CRDTS field not persisting when saved in Edit Agent dialog — root cause: listWorkforceAgents SELECT was missing crdts/agentStatus/dialerCredentials columns, so the edit form always opened with undefined; fixed by adding those columns to the list query
