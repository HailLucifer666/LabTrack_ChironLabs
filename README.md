# LabTrack

Dental case management, done right. LabTrack is a dashboard for dental labs to track clinic cases — built around three answers to a real client brief:

1. **Due dates that never drift.** A due date is a calendar date, not a timestamp. It renders as the same day everywhere.
2. **A clinic gets a message when work is ready.** Email notification workflow with an explicit, honest test mode.
3. **A dashboard that is calm.** Clear counts, instant search and filters, and one screen that answers "where are we today?"

Built with Next.js 15 and React 19. Runs in demo mode out of the box — no accounts, no credentials — and upgrades to a Supabase database and live email with configuration only.

---

## Features

| | |
|---|---|
| **Case dashboard** | Summary counts, search, and status filter over the full case list |
| **Date-only due dates** | `YYYY-MM-DD` persisted as Postgres `DATE`, formatted directly — immune to time-zone drift |
| **Two independent signals** | Production status (In progress / Ready) and deadline condition (Overdue / Due today / Upcoming) never mask each other |
| **Mark Ready → notify** | Generates recipient, subject, and body; previews in test mode, sends live only when fully configured |
| **Guarded delivery** | Duplicate notifications blocked; failures surfaced instead of silently swallowed |
| **Responsive** | Table on desktop, card list and off-canvas nav on small screens; collapsible sidebar on desktop |

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no credentials configured, the app runs in clearly labelled demo mode: synthetic cases, browser-local state, email previews that are never delivered.

Node.js 20+ and npm required.

### Testing

```bash
npm test
```

Four verification suites run in place against the real modules:

- `test:dates` — date-only formatting and time-zone rollover
- `test:demo` — sanitising of hostile or corrupted browser storage
- `test:notify` — the notification send/preview boundary matrix
- `test:routes` — route-boundary checks: demo mode never sends, malformed payloads are rejected

`typecheck` and `lint`: `npm run typecheck`, `npm run lint`.

## Configuration

Everything in this table is optional; the app degrades gracefully without credentials.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Enables Supabase-backed case storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Authenticates server route handlers to Supabase |
| `LAB_TIME_ZONE` | Server | IANA zone for business-date overdue logic (default `Asia/Kolkata`) |
| `RESEND_API_KEY` | Server | Enables actual email delivery |
| `EMAIL_FROM` | Server | Verified sender identity for Resend |

### Persistent database (recommended for deployment)

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

The service-role key never reaches browser code. This MVP has no authentication — do not add real clinic or patient data before adding auth and Row Level Security.

### Live email

Live sending requires **all three** of: database mode configured, `RESEND_API_KEY` and `EMAIL_FROM` set, and a non-placeholder recipient. Anything less returns a test-mode preview that states no email was delivered — demo mode cannot send real email even with a provider key present.

## Engineering decisions

### Due dates are dates, not instants

`due_date` is a Postgres `DATE` represented as `YYYY-MM-DD` and never passed through `new Date('2026-11-05')` — that constructor reinterprets the value as midnight UTC and shifts it in any offset. `formatDateOnly()` formats the components directly, so `2026-11-05` reads as **5 Nov 2026** in every browser and every time zone. Time-specific deadlines, if ever introduced, should store the instant plus its IANA zone separately — not a hard-coded one-day correction.

### Overdue is a date fact, not a status

Overdue is computed from calendar dates alone — `dueDate < todayDate` in `LAB_TIME_ZONE`. Production status is never consulted: a case marked Ready but past its due date still surfaces as overdue, because it still needs collecting. "Due today" is pressure, not lateness, and never overlaps overdue.

### Email cannot half-send

The notify route is a single decision with no partial outcomes: either the persisted status check, the provider configuration, and the recipient validation all pass — in which case it sends — or the client receives an explicit test-mode result. The database check runs on the server against the live configuration, so a provider key alone is never enough.

## API

| Route | Description |
|---|---|
| `GET /api/cases` | Cases from Supabase, or synthetic seeded data in demo mode |
| `POST /api/cases` | Creates a case; input is trimmed, validated, and rejected with `400` |
| `PATCH /api/cases/:id/ready` | Marks a case Ready; unknown ids are `404`, duplicate writes are `409` |
| `POST /api/cases/:id/notify` | Live Resend send only under the full guard; otherwise test-mode preview |

## AI tooling

Built with AI-assisted workflows, reviewed and verified throughout — using AI for leverage, not delegation:

- **Claude Code** — implementation pairing: components, API routes, data handling, and the test suites.
- **Codex** — UI/UX direction for the dashboard: information hierarchy, spacing and typography system, responsive behavior.

Every change landed was applied against a verification set — typecheck, lint, four smoke suites, and direct browser checks — and reviewed before being pushed. AI produced and iterated on code; every gate it had to pass was designed so that a wrong suggestion showed up as a red test rather than a plausible-looking commit. Verification records and measured results are in [`docs/BUILD_STATUS.md`](./docs/BUILD_STATUS.md).

## Project documentation

| Document | Contents |
|---|---|
| [`docs/TICKETS.md`](./docs/TICKETS.md) | Feature tickets with acceptance criteria |
| [`docs/PRD.md`](./docs/PRD.md) | Product requirements, open questions for the client, and recorded assumptions |
| [`docs/CLIENT_UPDATE_DRAFT.md`](./docs/CLIENT_UPDATE_DRAFT.md) | Client update email draft |
| [`docs/LOOM_SCRIPT.md`](./docs/LOOM_SCRIPT.md) | Product walkthrough script |
| [`docs/BUILD_STATUS.md`](./docs/BUILD_STATUS.md) | Measured verification results — commands and outcomes, not claims |

## Known limitations

- Demo-mode state is browser-local, not a shared durable database
- No authentication, roles, or tenant isolation — demo data only until auth exists
- Notification history lives on the case row; production should add an immutable notifications table with provider response IDs, retry, and deduplication
- All sample addresses are RFC-reserved placeholders (`clinic-demo@example.com` and similar)
- Email is the first notification channel by client agreement; WhatsApp is future scope
