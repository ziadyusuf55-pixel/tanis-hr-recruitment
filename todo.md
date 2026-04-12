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
