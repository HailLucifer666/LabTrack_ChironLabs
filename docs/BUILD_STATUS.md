# Build and verification status

Measured 2026-10-27 in this working copy (Node 24.18.0, Next.js 15.5.28, Windows). Commands and results, not claims.

## Passing

- `npm install` — 312 packages installed.
- `npm run build` — **passes**: optimized production build compiled in ~11s, lint and type validation ran as part of the build, all routes emitted (`/` static, three API routes dynamic; first load JS 103 kB shared).
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (0 errors, 0 warnings).
- `npm test` — passes:
  - `test:dates`: date-only formatting across five zones, calendar-date validation (leap days, impossible dates), fixed-instant time-zone rollover (23:30Z splits 27th/28th across zones), `LAB_TIME_ZONE` env honouring, invalid-zone warning + fallback.
  - `test:demo`: demo-state sanitizer against hostile shapes, partial corruption, enum drift, duplicate ids.
  - `test:notify`: database × provider × recipient matrix; demo workspaces never send, even with provider credentials present. Reserved placeholder detection covers RFC 2606/6761 domains and stays suffix-anchored.
  - `test:routes`: imports the real `app/api/cases` and `app/api/cases/[id]/notify` handlers with only `next/server` and the Supabase client stubbed. Proves demo + provider credentials + a real address still previews and never touches `fetch`; malformed case payloads are 400 (not 500); POST trims and validates; blank supplied ids and seeded-id reuse are rejected; an invalid `LAB_TIME_ZONE` is not echoed.
- Live dev-server probes (2026-10-28, demo mode) — guards behave as documented: blank/whitespace create 400, blank supplied id 400, seeded-id reuse 409, malformed notify payload 400, id-mismatch payload 400, unknown case 404, notify-before-ready 409, duplicate-notify 409; demo notify returns an explicit test-mode preview (`mode: "test"`, `persisted: false`). LT-1038 renders as Previewed, not Sent.
- Mutation probes (run 2026-10-27/28, then restored): removing the demo email gate, trusting raw stored arrays, and formatting every zone as UTC each turned the corresponding suite red. Removing the `databaseConfigured` gate in `decideNotification` turned `test:routes` red with a 502 attempted send where a 200 preview was required; hard-coding the route to database mode also failed.
- Independent review (2026-10-27, fresh-context reviewer): verdict READY with 8 findings. Fixed: preview-write false success (route checks the write, client warns when status was not saved), zero-row update undetected (`.select("id")` row counts), routes untested (new `test:routes`), malformed payload 500 (validated as 400), blank create fields and seeded-id reuse (trim/validate/409), reserved-domain gap (RFC 2606/6761), seeded Sent claim (now Previewed), invalid-zone echo (`resolveTimeZone`). The read-check-send-write TOCTOU race in database mode remains a documented non-fix (no live database to prove an atomic claim against).

## Not verified here (stated, not implied)

- **Supabase-backed database mode**: no project is provisioned for this demo. Those paths are compile-checked, share the same mapping helper as the tested demo path, and are not integration-tested.
- **Live Resend delivery**: no credentials, by design. The send/preview boundary is covered by the notify matrix; an actual delivery was never attempted.
- **Responsive design**: breakpoints reviewed in CSS and exercised at desktop width; tablet/mobile layouts were not screenshot-verified in this session.
