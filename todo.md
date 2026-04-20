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

## Round 20 — WhatsApp Group Added Stage + Training Improvements
- [x] Rename pipeline stage `teams_invitation_sent` → `whatsapp_group_added` in DB enum migration
- [x] Update PIPELINE_STAGES_ZOD, STAGE_LABELS, STAGE_COLORS, ACTIVE_STAGES in pipeline.ts and shared/
- [x] Update Training page: allow assigning candidates from `whatsapp_group_added` stage
- [x] DB: add startDate and endDate fields to trainingBatches table
- [x] DB: add trainerNotes field to batchCandidates table (per-agent notes)
- [x] DB: add batchNotes field to trainingBatches table (what has been completed/not)
- [x] DB: add attendance tracking per agent in batchCandidates (attendedSessions, totalSessions)
- [x] Backend: update all batch-related DB helpers and tRPC procedures for new fields
- [x] Frontend: Training batch detail — show/edit trainer notes per agent
- [x] Frontend: Training batch detail — show/edit batch notes (completed topics checklist or free text)
- [x] Frontend: Training batch detail — show/edit attendance per agent
- [x] Frontend: Training batch detail — "Copy all phone numbers" button for WhatsApp group creation
- [x] Frontend: Training batch create/edit — add startDate, endDate fields
- [x] Update Dashboard funnel chart to use new stage label "WhatsApp Group Added"
- [x] Update all Vitest tests to use new stage name
