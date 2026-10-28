# LabTrack — Dental Case Dashboard MVP

A Next.js take-home assignment for Chiron Labs' Forward Deployed Engineer role. Demonstrates clean dental case management with date-only due dates, time-zone-aware overdue logic, and a Mark Ready notification workflow.

## Overview

LabTrack is a clinical case management dashboard handling:

- **Responsive case list** with summary counts, search, and status filter
- **Dual semantics**: production status (In progress / Ready) independent of deadline condition (Overdue / Due today / Upcoming)
- **Date-only due dates** (`YYYY-MM-DD`) formatted without timestamp parsing, preventing one-day shifts across time zones
- **Mark Ready** workflow with email notification preview/send
- **Optional Supabase** persistence for cases and notification status
- **Synthetic seeded data** with SQL schema for local setup

## Demo Mode (default)

The app runs in demo mode with no authentication, no real email delivery, and browser-local state. Sample cases are synthetic — do not use with real patient or clinic data without appropriate security work.

## Core Features

| Feature | Description |
|---|---|
| Case dashboard | Primary surface with summary counts, search, and status filter |
| Date handling | `YYYY-MM-DD` only; `formatDateOnly()` prevents timezone drift |
| Status/Deadline duality | Ready/In progress coexists with Overdue/Due today/Upcoming; a Ready case past its date still shows Overdue |
| Mark Ready | Triggers email notification workflow (test preview or live send) |
| Supabase persistence | Optional — `DATE` column, seeded schema included |
| Notification preview | Test mode shows recipient/subject/body; live send requires Resend + database mode |

## Requirements

- **Node.js 20+** (Node.js 22 recommended)
- **npm**
- **Optional**: Supabase project for persistent, database-backed cases
- **Optional**: Resend account and verified sender for live email (requires database mode)

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run the test suite:

```bash
npm test
```

This runs four compiled-in-place smoke suites:
- `test:dates` — date-only formatting and time-zone rollover
- `test:demo` — demo-state sanitising of hostile/corrupted browser storage
- `test:notify` — notification send/preview boundary matrix
- `test:routes` — route boundary checks (no demo email delivery, payload validation)

Open `http://localhost:3000`. Without Supabase or Resend credentials, the app runs in clearly labelled demo mode.

## Persistent Database (optional, recommended for deployment)

1. Create a Supabase project
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL Editor
3. Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
LAB_TIME_ZONE=Asia/Kolkata
```

> **Never** commit the service-role key to the browser or repo. This take-home does not implement authentication — do not add real clinic or patient data before adding auth and Row Level Security policies.

## Live Email (optional)

Requires all three: Supabase project configured (database mode), both variables set, and a non-placeholder recipient.

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=LabTrack <notifications@your-verified-domain.example>
```

If either variable is missing, the API returns a test-mode preview and the UI states no email was delivered. Demo mode cannot send real email even if both variables are set.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Enables Supabase-backed case storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server only | Authenticates server route handlers |
| `LAB_TIME_ZONE` | Optional; defaults to `Asia/Kolkata` | IANA zone for business-date overdue logic |
| `RESEND_API_KEY` | Optional | Enables actual email delivery |
| `EMAIL_FROM` | Optional | Verified sender identity for Resend |

## Date-Handling Decision

`due_date` is stored as Postgres `DATE` and represented as `YYYY-MM-DD`. A calendar due date is **not** an instant in time — the UI must not parse it with `new Date('YYYY-MM-DD')` and display it in the viewer's local zone. `formatDateOnly()` formats year/month/day components directly, preventing one-day shifts across positive and negative UTC offsets.

For time-specific deadlines, store the instant plus its IANA zone separately. Do not use a hard-coded one-day correction.

### Overdue policy (status-independent)

Overdue is derived from calendar dates alone: `dueDate < todayDate` in `LAB_TIME_ZONE`. Production status is never consulted — a case already marked Ready but past its date still surfaces as overdue (it needs collecting). "Due today" (`dueDate === todayDate`) is pressure, not lateness, and is never overdue until the day has passed.

## API Routes

| Route | Description |
|---|---|
| `GET /api/cases` | Reads cases from Supabase or returns synthetic seeded data in demo mode |
| `POST /api/cases` | Creates a case in Supabase or returns a demo case (browser local storage) |
| `PATCH /api/cases/:id/ready` | Marks a case Ready in Supabase or updates demo state |
| `POST /api/cases/:id/notify` | Sends via Resend only in database mode with a non-placeholder recipient; otherwise returns test-mode preview |

## Limitations (known)

- Demo-mode state is browser-local, not a shared durable database
- No authentication, user roles, or tenant isolation
- Notification history represented on a case only — production should add an immutable notifications table with provider response IDs, retry/deduplication, and delivery audit history
- Sample addresses (`clinic-demo@example.com`, etc.) are synthetic placeholders
- Email is the first notification channel per the assignment; WhatsApp is out of scope

## Run tests

```bash
npm test
```

This runs four compiled-in-place smoke suites: date-only formatting, demo-state sanitisation, the notification send/preview boundary matrix, and route boundary checks.

Open `http://localhost:3000` to verify the dashboard, date display, mark-ready action, and test email preview.
