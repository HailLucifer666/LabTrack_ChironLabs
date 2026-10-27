# LabTrack — Product Requirements Document (PRD)

**Project:** Chiron Labs Forward Deployed Engineer take-home  
**Product:** LabTrack — Dental case tracking MVP  
**Document status:** Build-ready draft; assumptions are explicitly marked  
**Target delivery:** A focused 3–4 hour take-home implementation  
**Primary demo deadline:** Friday demo (exact date/time to be confirmed by client)

## 1. Executive summary

LabTrack is a lightweight web application for dental laboratories to track cases submitted by dental clinics. The lab owner, Maria, has raised three problems: due dates shift by a day for some international clinics, clinics need an update when a case is ready, and the dashboard feels cluttered before an important demo.

This MVP will provide a clean case list, correct date-only deadline handling, and an email notification workflow with an explicit test mode when real delivery credentials are unavailable. The solution will be built with Next.js, published in a public GitHub repository, and deployed to Vercel. It is a demonstrable prototype, not a complete production dental-lab system. **Guiding principle:** prioritize a small feature that works correctly and communicates its limits over broad functionality that only appears to work.

## 2. Problem statement

- **Date correctness:** Dates appear one day early or late for users in other countries, likely because a calendar deadline is being parsed or stored as a timestamp and converted between time zones.
- **Clinic communication:** Clinic staff do not have a reliable notification when a case is marked ready.
- **Dashboard usability:** The existing dashboard is perceived as cluttered, making it harder to scan case status and act quickly during the demo.

The demo must show that these issues have been addressed in a practical, explainable way.

## 3. Goals and non-goals

### Goals

1. Show a clear list of dental cases with case ID, clinic, work type, due date and status.
2. Store and render a due date as a calendar date, without unintended time-zone shifts.
3. Allow a lab user to mark a case as ready and trigger an email notification workflow.
4. Provide a safe, clearly labelled email test mode when real email delivery is not configured.
5. Reduce visual clutter through hierarchy, spacing, status badges, filters and responsive layout.
6. Make the app easy for a reviewer to test using seeded sample data.
7. Deliver a Vercel deployment, public GitHub repository, a short demo video, client update and application email.

### Non-goals for this take-home

- WhatsApp integration (Maria says email is acceptable to start).
- Full authentication, user invitations, granular permissions or audit compliance.
- Real clinic onboarding, billing, inventory, manufacturing workflow or regulatory/clinical functionality.
- File uploads, dental images, CAD/CAM integrations, or patient-identifiable data.
- Complex multi-tenant isolation or enterprise-grade operational monitoring.
- Automated sending to real clinics unless a real provider and approved configuration are available.

## 4. Users and jobs to be done

### Primary user: Dental lab staff member

**Need:** Quickly locate a case, understand its deadline and current status, and notify the clinic when it is ready.  
**Success looks like:** A staff member can identify urgent work and mark a completed case ready without navigating a cluttered interface.

### Secondary user: Lab owner (Maria)

**Need:** Confidence that dates are dependable, clinics receive updates, and the app presents well during the Friday demo.  
**Success looks like:** Maria can explain the improvements and see transparent status when an email is sent or only simulated.

### External recipient: Clinic contact

**Need:** Receive a concise, actionable email indicating which case is ready.  
**Success looks like:** The email identifies the case reference and gives a clear next step without exposing unnecessary patient data.

## 5. Scope and priority

| Priority | Capability | Scope |
|---|---|---|
| P0 | Case list dashboard | Show seeded cases, status, clinic, type and due date; clear visual hierarchy |
| P0 | Date-only correctness | Store dates as `YYYY-MM-DD`; render without converting the calendar date into a different time zone |
| P0 | Ready status action | Allow a case to move to Ready and reflect the new status in the UI |
| P0 | Email notification workflow | Generate a case-ready email and support real provider delivery only when configured; otherwise use a labelled test mode |
| P0 | Deployment/documentation | Public GitHub repo, Vercel deployment, setup README, env-var guidance |
| P1 | Search and filters | Search by case/clinic and filter by status |
| P1 | Notification feedback | Display sent/tested/failed outcome and prevent misleading success claims |
| P2 | WhatsApp | Not included in MVP; revisit after confirming provider, consent and message template requirements |

## 6. Functional requirements

### FR-1: View cases

The dashboard shall display a list or table containing:
- Case reference (unique, e.g. `LT-1042`).
- Clinic name.
- Case type (e.g. crown, bridge, aligner).
- Due date.
- Workflow status (`In progress`, `Ready`, `Overdue` as a derived visual state where appropriate).
- Notification state where relevant (e.g. `Not sent`, `Test email generated`, `Sent`, `Failed`).
- A primary row action to view or update case status.

The page should include a compact summary of total cases, cases in progress, ready cases and overdue cases. Summary values must be computed from the displayed dataset rather than hard-coded.

### FR-2: Search and filter (P1, expected if time allows)

- Search shall match case reference or clinic name without case sensitivity.
- Status filter shall allow users to see all cases or a selected workflow status.
- Empty search results shall show a helpful empty state and a way to clear the filter.

### FR-3: Correct due-date handling

**Rule:** A deadline that represents a calendar day, rather than a specific instant, shall be represented as a date-only value (`YYYY-MM-DD`) from data persistence through display. The UI must not parse it as a UTC timestamp and then render it in the browser's local time zone.

Acceptance details:
- A due date of `2026-10-29` displays as 29 Oct 2026 in any browser time zone.
- Changing the browser time zone must not change the displayed calendar date.
- The date is not shifted by adding/removing a UTC offset.
- Date comparisons for overdue status use a clearly documented business date convention (MVP assumption: compare the date-only deadline with the current date in the lab's configured/default business time zone; if no lab time zone is configured, use a documented demo default).
- If a future requirement defines a deadline time, store a timestamp plus its governing IANA time zone separately; do not overload a date-only value.

Implementation note: avoid `new Date('YYYY-MM-DD')` for display. Format the date-only string by parsing its year/month/day components or use a date-only-aware library. Keep the original ISO date string as the source of truth.

### FR-4: Mark a case ready

- A user can mark an eligible case as `Ready` from the dashboard or case details.
- The status change shall be visible immediately after the action succeeds.
- Repeating the action on a case already marked ready shall not create uncontrolled duplicate notifications.
- If status persistence fails, show an error and do not claim that the update succeeded.

### FR-5: Notify the clinic by email

When a case is marked Ready, a user can trigger a case-ready email.

Email requirements:
- Recipient: clinic contact email associated with the case (seeded demo address is acceptable).
- Subject: `LabTrack: Case <case reference> is ready`.
- Body: identify the lab, case reference, work type and readiness status; include a clear instruction for the clinic to contact the lab if it has a question.
- Do not include patient-sensitive information in sample emails.
- The UI must distinguish real provider delivery from test/simulated mode.
- The user must see a success or failure outcome after the action.
- The notification action should be idempotent or guarded so repeated clicks do not create unintended duplicate sends.

**Test mode:** If a provider is not configured, create a notification preview or server-side test record, clearly label it `TEST MODE — no email delivered`, and show the rendered recipient, subject and body. Do not present simulation as a real email send.

**Real sending:** If a provider such as Resend is configured, send only through a server-side route/action using environment variables. Never expose API keys to the browser. Deployment is allowed to remain in test mode if secrets are unavailable.

### FR-6: Dashboard usability and design

- Use clear page title and concise subtitle.
- Put key counts before the case list, but keep them visually secondary to the actual work list.
- Use consistent status labels and colours with accessible text contrast; status must not be conveyed by colour alone.
- Keep columns aligned and scannable; prioritise case reference, clinic and due date.
- Provide visible hover/focus states and keyboard-operable controls.
- Use responsive layout: table on desktop; a readable compact list/card treatment on narrow screens.
- Include loading, empty, success and error states where relevant.
- Avoid decorative charts or widgets that do not support the case-management task.

## 7. User stories and acceptance criteria

### Ticket LT-01 — Fix date shifting

**User story:** As lab staff, I need due dates to remain the same calendar day across countries so that the lab and clinic agree on the deadline.

**Acceptance criteria:**
1. Given a case with due date `2026-10-29`, when opened in time zones such as Asia/Kolkata, Europe/London and America/Los_Angeles, the UI displays 29 Oct 2026 in all of them.
2. The stored source of truth is a date-only string or database `DATE`, not a midnight UTC timestamp.
3. Date formatting does not change the underlying value.
4. Automated/manual test evidence covers at least positive and negative UTC offsets.
5. Overdue labels follow the documented lab business-date convention.

### Ticket LT-02 — Notify clinic when ready

**User story:** As lab staff, I want to notify a clinic when its case is ready so that the clinic can plan collection or next steps.

**Acceptance criteria:**
1. A Ready action changes the case status only after the update succeeds.
2. The notification message includes case reference, work type and readiness status.
3. Test mode clearly says no real email was delivered and shows a usable preview.
4. When a real provider is configured, the server performs the send and returns a trustworthy result.
5. Failure is surfaced to the user; no false success state is shown.
6. Duplicate clicks/retries are guarded or recorded to avoid unintended repeated sends.
7. No secret API key is sent to the client.

### Ticket LT-03 — Simplify case dashboard

**User story:** As Maria and lab staff, I want a less cluttered dashboard so that the team can quickly understand current workload before the demo.

**Acceptance criteria:**
1. The page shows summary counts and a clear case list.
2. Each case shows reference, clinic, type, deadline and status without requiring a detail page.
3. Users can distinguish Ready, In progress and Overdue cases using label text and visual styling.
4. Search/filter controls work if included in the delivered build.
5. Layout is usable at common desktop widths and on mobile widths.
6. Empty/error states are understandable and do not look like application crashes.

## 8. Questions to ask Maria before production use

These are discovery questions. For the take-home, document reasonable assumptions and proceed rather than blocking implementation.

### Due dates
1. Is the due date a calendar day or an exact deadline time?
2. If it is time-specific, should the deadline follow the lab's time zone or the receiving clinic's time zone?
3. Which time zone should determine whether a case becomes overdue?
4. How are existing dates currently stored, and are any historical dates already corrupted?

### Email notification
5. Which clinic contact should receive the email when multiple contacts exist?
6. What sender name/address and reply-to address should be used?
7. Should notifications be automatic when a case becomes Ready or triggered manually by staff?
8. Should a clinic receive repeat notifications if a case is reopened and marked ready again?
9. Is there an approved email provider and production sending domain? Are there required consent, privacy or retention rules?

### Dashboard
10. Which roles use the dashboard daily, and what are their most important actions?
11. Which information is clutter, and which fields must always remain visible?
12. Does Maria prefer a table, board or another view?
13. What sample case data is safe to use in the Friday demo?

### Delivery
14. What is the exact Friday demo date/time and who will be testing the build?
15. Are there brand guidelines, accessibility requirements or existing repository conventions?

## 9. Assumptions for the take-home

- This is a standalone demo MVP with non-sensitive synthetic data.
- Cases are seeded locally or stored in a simple database; no migration of a real legacy dataset is required.
- Due dates are calendar days unless Maria confirms that a time-specific deadline is required.
- A default lab business time zone will be documented for overdue calculations if needed.
- Email should be implemented before WhatsApp.
- Test mode is acceptable when live email credentials are unavailable; this is visible in both the UI and README.
- There is no authentication requirement in the take-home, so the demo is not suitable for real clinic data until authentication and authorization are added.

## 10. UX specification

### Information architecture

- **Header:** LabTrack wordmark, `Cases` navigation, visible demo/test-mode indicator.
- **Page introduction:** `Cases` title and one-line purpose.
- **Summary row:** Total cases, In progress, Ready, Overdue.
- **Toolbar:** Search, status filter, optional clear action.
- **Case list:** Case reference, clinic, type, due date, status, notification state, actions.
- **Feedback:** Toast/inline message for status changes and notification results.
- **Notification preview:** Modal or panel that displays recipient, subject, body and `TEST MODE` label when not actually sent.

### Visual direction

Professional B2B software. Neutral background, restrained accent colour, good typography, generous spacing, subtle borders and consistent status pills. The case list is the centre of the page; avoid dashboard clutter such as unnecessary charts, excess cards or decorative visualisations.

### Accessibility and responsive behaviour

- Every control has a visible label or accessible name.
- All actions are keyboard reachable and focus-visible.
- Text contrast meets a reasonable WCAG AA target.
- Status includes readable text in addition to colour.
- At narrow widths, preserve case reference, clinic, due date and status; secondary details can wrap or move into a compact card layout.

## 11. Proposed technical design

### Stack

- **Framework:** Next.js with App Router and TypeScript.
- **UI:** Tailwind CSS or equivalent utility/CSS approach.
- **Persistence:** A simple database is acceptable. For the shortest take-home path, use SQLite/Prisma locally or a hosted Postgres service if Vercel persistence is required. Do not rely on a writable local filesystem for persistent production data on Vercel.
- **Email:** Server-side provider integration such as Resend, behind environment variables; explicit preview/test fallback if credentials are absent.
- **Hosting:** Vercel.
- **Version control:** Public GitHub repository.

### Logical data model

**Case**
- `id`: stable unique identifier.
- `reference`: unique human-readable case reference.
- `clinicName`: required string.
- `clinicEmail`: recipient email.
- `caseType`: crown, bridge, aligner or other short label.
- `dueDate`: date-only `YYYY-MM-DD` / database `DATE`.
- `status`: `IN_PROGRESS` or `READY` for the initial workflow.
- `createdAt`, `updatedAt`: timestamps for record auditing.

**Notification**
- `id`: stable unique identifier.
- `caseId`: associated case.
- `channel`: `EMAIL`.
- `mode`: `TEST` or `LIVE`.
- `recipient`, `subject`, `body`: rendered message fields (or appropriately limited preview fields).
- `status`: `PREVIEWED`, `SENT`, `FAILED`.
- `providerMessageId`: optional provider response ID.
- `createdAt`: timestamp.

For a very small demo, the notification record can be an in-memory/local model, but a deployed version should persist it if the status is presented as an enduring history. Document any persistence limitation honestly.

### API/action outline

- `GET /api/cases` — return case list and summary data.
- `PATCH /api/cases/:id` — update permitted case fields, including ready status.
- `POST /api/cases/:id/notify` — validate case and recipient, build email, run provider send or test-mode preview, return explicit mode/status.

All input must be validated on the server. Errors should return a useful message without leaking secrets or stack traces.

### Date handling rule

Do not treat a date-only field as an instant. Keep `YYYY-MM-DD` intact, format the day/month/year from the string (or a date-only library), and only use time-zone-aware timestamp logic for events that truly represent a moment. Do not apply an arbitrary `+/- 1 day` correction.

## 12. Non-functional requirements

- **Reliability:** Main page should load with seed/demo data; core actions should fail visibly rather than silently.
- **Security:** No credentials in client bundles or committed files; use Vercel environment variables for secrets.
- **Privacy:** Use synthetic demo data; avoid patient names or clinical identifiers in emails.
- **Performance:** For a small seeded dataset, dashboard interactions should feel immediate and require no full-page reload where practical.
- **Maintainability:** Components and data/date/notification logic should be separated enough to explain during the Loom walkthrough.
- **Transparency:** Clearly disclose test-mode email and any demo-only persistence or authentication limitations.
- **Accessibility:** Keyboard access, readable statuses, focus styles and responsive layout.

## 13. Test plan

### Date tests
1. Render `2026-10-29`; assert the visible value is 29 Oct 2026.
2. Test the same date under positive and negative UTC offsets; visible calendar day must remain unchanged.
3. Confirm there is no one-day workaround or mutation of the source date.
4. Test the overdue boundary according to the documented business-date convention.

### Case workflow tests
5. Mark an in-progress case Ready; ensure status and summary counts update.
6. Trigger a notification in test mode; check that the screen explicitly says no real email was delivered.
7. Check recipient, subject and body in preview.
8. Simulate provider failure (if provider code exists) and confirm a failure is shown without false success.
9. Repeat the notify action and confirm duplicate behaviour is guarded or transparent.

### Dashboard tests
10. Confirm all key fields display for each case.
11. Search by case reference and clinic name.
12. Filter by status and clear filters.
13. Test empty results, loading/failure state and responsive layouts.
14. Use keyboard navigation to reach and activate controls.

### Deployment smoke tests
15. Open the Vercel URL in a fresh/incognito browser.
16. Confirm sample data loads, due dates render correctly, and test email works without missing secrets.
17. Confirm server-side secrets are not exposed in the browser or repository.
18. Verify README setup instructions match the actual code.

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing dates are timestamps with ambiguous semantics | Historical deadlines may already be wrong | Do not silently rewrite historical dates; clarify intended business date and audit migration separately |
| Live email credentials are unavailable | Reviewer cannot verify a real delivery | Implement a clear test/preview mode and explain setup for live sending |
| Vercel deployment uses ephemeral local storage | Updates may not persist across deployments/instances | Use hosted DB for shared persistence or disclose demo-only storage and avoid claiming production persistence |
| Scope expands to WhatsApp/auth/production workflow | Take-home exceeds 3–4 hours | Keep WhatsApp and production hardening out of scope |
| Demo data accidentally implies real patients | Privacy risk | Use synthetic clinic/case data only |
| Duplicate notification sends | Clinics receive repeated messages | Guard duplicate clicks and record notification outcome |

## 15. Build plan (3–4 hour timebox)

| Timebox | Work | Expected outcome |
|---|---|---|
| 0:00–0:20 | Confirm scope, scaffold app, define sample data and assumptions | App skeleton and clear data model |
| 0:20–1:00 | Build dashboard layout, seeded cases, summary counts, search/status filter if practical | Usable first screen |
| 1:00–1:30 | Implement date-only storage and rendering; verify across offsets | Date bug fixed at source |
| 1:30–2:15 | Implement Ready action and email send/test-mode preview | Demonstrable notification workflow |
| 2:15–2:45 | Polish responsive styling, states and README | Demo-quality UI and instructions |
| 2:45–3:20 | Test key flows and fix defects | Evidence of core acceptance criteria |
| 3:20–4:00 | Push GitHub, deploy Vercel, smoke test, record Loom outline | Submission links and demo ready |

If a step takes longer than planned, cut optional styling or search improvements first. Do not cut correct date handling, honest notification mode, or deployment smoke tests.

## 16. Demo scenario

1. Open the live app and show the case summary and uncluttered list.
2. Point out a case due on `2026-10-29`; explain that it is stored as a date-only value to prevent a time-zone conversion from changing the calendar day.
3. Open an in-progress case and mark it Ready.
4. Trigger the email action and show either the delivered provider result or the explicitly labelled test-mode preview.
5. Explain one decision that could be improved later (for example, persistent notification audit history or configurable lab/clinic time zones) and why it was excluded from the timeboxed MVP.

## 17. Deliverables and definition of done

The take-home is ready to submit when:

- [ ] This PRD/ticket set and questions for Maria are included.
- [ ] A Next.js app displays sample cases in a clean dashboard.
- [ ] Due dates remain the same calendar day regardless of viewer time zone.
- [ ] A case can be marked Ready.
- [ ] The email workflow works in real mode when configured, or test mode is unmistakably labelled and demonstrable.
- [ ] User sees notification success/failure without misleading status.
- [ ] Basic tests/manual checks cover date offsets and notification states.
- [ ] Public GitHub repository exists with a useful README.
- [ ] Vercel deployment exists and has been smoke-tested.
- [ ] Client update email accurately states what shipped, what did not, and what is needed from Maria.
- [ ] Loom walkthrough is no longer than three minutes.
- [ ] Application email uses exact subject: `FDE – Your Name – Friday demo` and includes all links, answers to the four questions, AI-tool disclosure and LinkedIn profile.

## 18. Client update email outline

**Subject:** LabTrack demo update

Hi Maria,

I’ve made the case dashboard easier to scan, corrected how calendar due dates are handled so they don’t shift when viewed from another time zone, and added a case-ready email workflow. The demo is using **[test mode / live email]**; if it is in test mode, no email is sent to a real clinic.

I haven’t added WhatsApp yet because email was the agreed first step and it lets us validate the workflow sooner. Before using this with real clinics, I need you to confirm which time zone should govern overdue cases, which clinic contact should receive each email, and the preferred sender/message wording.

Thanks,  
[Your name]

*Only use statements that match the final implementation.*

## 19. Open decisions before production

- Business time zone and whether a deadline is date-only or time-specific.
- Historical date data correction and migration policy.
- Authentication, staff roles and clinic data access boundaries.
- Approved email provider, sender domain, retry rules and notification retention.
- Whether a notification is automatic or staff-triggered.
- WhatsApp requirements, consent, message template and provider.
- Persistent database choice, backup, monitoring and production support expectations.

