# LabTrack — Dental case operations MVP

A Next.js take-home MVP for Chiron Labs' Forward Deployed Engineer assignment. It demonstrates a cleaner dental case dashboard, date-only due-date handling, a Mark Ready workflow, and an email notification preview with an optional live-send path.

> **Demo safety note:** The default configuration is `Demo mode`. Sample cases are synthetic, case edits are stored in the current browser's local storage, and notifications produce an email preview only. No real email is delivered until server-side email credentials are configured. This demo does not include authentication and must not be used with real patient or clinic data without appropriate security work.

## Features

- Responsive case dashboard with summary counts, case list, search and status filter.
- Date-only due dates (`YYYY-MM-DD`), formatted without parsing a date-only string as a timestamp. The lab's time zone is configurable for overdue labelling.
- Mark a case Ready and trigger an email notification workflow.
- Explicit test-mode preview showing recipient, subject and body; a configured Resend account can send live email.
- Optional Supabase Postgres persistence for cases and notification status.
- Synthetic seeded data and SQL schema.

## Requirements

- Node.js 20+ (Node.js 22 recommended).
- npm.
- Optional: Supabase project for persistent database-backed cases.
- Optional: Resend account and verified sender for live email delivery.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run the test suite after installing dependencies:

```bash
npm test
```

This runs three compiled-in-place smoke suites: date-only formatting and time-zone rollover (`test:dates`), demo-state sanitising of hostile/corrupted browser storage (`test:demo`), and the notification send/preview boundary matrix (`test:notify`).

Open `http://localhost:3000`. With no Supabase or Resend credentials, the app runs in clearly labelled demo mode.

## Persistent database setup (optional but recommended for deployment)

1. Create a Supabase project.
2. Open its SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy the Project URL and service role key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
LAB_TIME_ZONE=Asia/Kolkata
```

The service-role key is server-side only. Never prefix it with `NEXT_PUBLIC_`, never commit it, and never put it in browser code. Because this take-home does not implement authentication, do not add real clinic or patient data. Before production use, add authentication/authorization and appropriate Supabase Row Level Security policies.

## Enable real email delivery (optional)

1. Configure a Resend account and verify the sender domain/address.
2. Add these environment variables on the server and in Vercel Project Settings → Environment Variables:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=LabTrack <notifications@your-verified-domain.example>
```

If either variable is missing, the API returns a test-mode preview and the UI explicitly says **no email was delivered**. In demo mode (no Supabase configuration) the API always returns a preview and never contacts the provider, even if both email variables are set — demo workspaces cannot send real email. If live mode is configured, the server sends email via Resend; no secret is bundled into client JavaScript.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Enables Supabase-backed case storage when paired with the service key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server only | Authenticates server route handlers to Supabase |
| `LAB_TIME_ZONE` | Optional; defaults to `Asia/Kolkata` | IANA zone used to determine the business date for overdue status |
| `RESEND_API_KEY` | Optional | Enables actual email delivery |
| `EMAIL_FROM` | Optional | Verified sender identity for Resend |

## Date-handling decision

`due_date` is stored as a Postgres `DATE` and represented in the app as `YYYY-MM-DD`. A calendar due date is not an instant in time, so the UI must not parse it with `new Date('YYYY-MM-DD')` and then display it in the viewer's local time zone. `formatDateOnly()` formats the year/month/day components directly, preventing a one-day shift across positive and negative UTC offsets.

For a genuine time-specific deadline, confirm the governing business time zone with the client and store the deadline instant plus its IANA zone separately. Do not use a hard-coded one-day correction.

## API routes

- `GET /api/cases` — reads cases from Supabase or returns synthetic seeded data in demo mode.
- `POST /api/cases` — creates a case in Supabase or returns a demo case that is stored in browser local storage.
- `PATCH /api/cases/:id/ready` — marks a case Ready in Supabase or updates demo state in the browser.
- `POST /api/cases/:id/notify` — sends via Resend when configured; otherwise returns an explicit test-mode email preview.

## Deploy to Vercel

1. Create a **public GitHub repository** and push this project.
2. In Vercel, select **Add New → Project**, import the GitHub repository and keep the Next.js defaults.
3. Add the environment variables from `.env.example`. For a quick demo, the database and live-email variables can be omitted; the dashboard will stay in demo/test mode. For durable shared data, configure Supabase before deploying.
4. Deploy. Open the production URL in a fresh browser and smoke-test the cases list, date display, mark-ready action and test email preview.
5. Confirm the UI accurately discloses demo mode if Supabase/Resend are not configured.

## Manual acceptance checklist

- [ ] `2026-10-29` renders as **29 Oct 2026**, regardless of the browser time zone.
- [ ] Overdue is derived by comparing date-only values to the current date in `LAB_TIME_ZONE`.
- [ ] Search finds cases by case reference, clinic name or case type.
- [ ] Status filter works for In progress, Ready and Overdue.
- [ ] Mark Ready updates the status and counts.
- [ ] Notify opens an email preview in test mode and clearly states no message was delivered.
- [ ] Invalid or unsuccessful operations show an error instead of a false success.
- [ ] New cases can be created; in demo mode they persist only in the current browser.
- [ ] Public deployment and repository include no secrets.

## Known take-home limitations

- Demo-mode state is browser-local rather than a shared durable database.
- The demo has no authentication, user roles or tenant isolation.
- Notification history is represented on a case; a production build should add an immutable notifications table with provider response IDs, retry/deduplication rules, and delivery audit history.
- `clinic-demo@example.com` and the other sample addresses are synthetic placeholders, not real delivery destinations.
- WhatsApp is intentionally out of scope; email is the first notification channel per the assignment.
