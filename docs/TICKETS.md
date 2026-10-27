# LabTrack feature tickets

## LT-01 — Fix date shifting

**User story:** As lab staff, I need due dates to remain the same calendar day across countries so that the lab and clinic agree on a deadline.

**Acceptance criteria**
- A case due `2026-10-29` renders as `29 Oct 2026` in any browser time zone.
- A date-only value is stored as `YYYY-MM-DD` / database `DATE`, not midnight UTC.
- Formatting does not mutate the stored date.
- Overdue calculations compare date-only values using the documented lab business time zone.
- No arbitrary plus/minus-one-day correction is used.

## LT-02 — Notify clinic when ready

**User story:** As lab staff, I want to notify a clinic when its case is ready so the clinic can plan collection or next steps.

**Acceptance criteria**
- A user can mark a case ready; the status and counts update only after the action succeeds.
- A ready case can generate an email with recipient, case reference, case type, subject and message body.
- Test mode clearly states that no email was delivered and shows a preview.
- Real sending is only enabled by server-side provider credentials.
- Failure is surfaced honestly and duplicate live notifications are guarded.
- API secrets never reach browser code.

## LT-03 — Simplify case dashboard

**User story:** As Maria and lab staff, I want a less cluttered dashboard so the team can quickly understand workload before the demo.

**Acceptance criteria**
- Summary counts are computed from current cases.
- Case reference, clinic, case type, due date, status and notification state are visible.
- Search and status filters work.
- Status is communicated using both text and styling.
- Loading, empty and error states are understandable.
- Desktop and mobile layouts remain usable.
