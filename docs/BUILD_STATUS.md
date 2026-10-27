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
  - `test:notify`: database × provider × recipient matrix; demo workspaces never send, even with provider credentials present.
- Live dev-server probes — guards behave as documented: invalid create 400, unknown case 404, notify-before-ready 409, duplicate-notify 409; demo notify always returns an explicit test-mode preview (`persisted: false`).
- Mutation probes (run 2026-10-27, then restored): removing the demo email gate, trusting raw stored arrays, and formatting every zone as UTC each turned the corresponding suite red.

## Not verified here (stated, not implied)

- **Supabase-backed database mode**: no project is provisioned for this demo. Those paths are compile-checked, share the same mapping helper as the tested demo path, and are not integration-tested.
- **Live Resend delivery**: no credentials, by design. The send/preview boundary is covered by the notify matrix; an actual delivery was never attempted.
- **Responsive design**: breakpoints reviewed in CSS and exercised at desktop width; tablet/mobile layouts were not screenshot-verified in this session.
