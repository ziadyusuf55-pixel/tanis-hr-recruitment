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
