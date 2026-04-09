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
