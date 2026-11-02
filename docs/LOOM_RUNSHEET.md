# Loom runsheet — timed cuts (target: 2:30–2:50)

Source: `docs/LOOM_SCRIPT.md`. This runsheet turns the script into a recordable sequence with precise cut points and retake-safe segments. Record each segment separately; trim the pauses; the final cut should land between 2:30 and 2:50.

| # | Segment | Time | Script line (from LOOM_SCRIPT.md) | Camera/screen notes |
|---|---|---|---|---|
| 1 | Context | 0:00–0:20 | “Maria raised three issues: due dates shift across time zones, clinics need a message when work is ready, and the dashboard is cluttered. I kept this MVP focused on those three outcomes.” | Screen: dashboard overview page. Keep this short, no needless setup. |
| 2 | Dashboard | 0:20–0:55 | Show summary counts, search/status filter, case table, overdue label. Point out status is written in text as well as colour. | Move cursor slowly; pause on the overdue label and the colour+text pair. |
| 3 | Date decision | 0:55–1:25 | “Due dates are calendar dates, not moments in time. I keep them as `YYYY-MM-DD` / database `DATE` and render the components directly. I do not parse midnight UTC and then convert it into the viewer's time zone, and I did not patch the bug by adding or subtracting a day.” | If possible, open two browser windows with different time zones to show the same date rendering — this is the strongest visual proof. |
| 4 | Ready + email | 1:25–2:00 | Mark an in-progress case Ready. Click Notify. Show the generated recipient, subject and message. State clearly that test mode creates a preview and does not deliver an email. A provider key on its own does not change that: this demo has no database configured, so it always previews. Only if you also configure Supabase-backed data and a real provider may you demonstrate the live path, and only say it sent if the provider confirms. | Highlight the `TEST MODE — no email was delivered` notice. Do not claim live delivery. |
| 5 | Trade-off (the "one decision I'd change" segment) | 2:00–2:35 | “One decision I'd change with more time is to create an immutable notification history table with provider IDs, deduplication keys and delivery attempts. For this timebox I kept the workflow small and made test mode explicit, but production needs better auditability and retry handling.” | This segment is the differentiator — deliver it looking at the camera, not the screen. |
| 6 | Close | 2:35–2:50 | Summarize what is complete and what remains: account configuration, confirmation of business time-zone rules, and WhatsApp only after email is validated. | End on a clear, single sentence. |

## Recording tips

- **Record segments 1–4 and 6 in one take on screen; record segment 5 separately** (camera/face) and splice it in at 2:00. This makes retakes cheap.
- **Target 2:40.** If you run long, trim segment 2 (dashboard) first — it is the least decision-critical.
- **Check the final cut** plays clean, no dead air at the top, and the close lands before 2:50.
- Do not include any screen content that shows credentials or the `RESEND_API_KEY` environment variable.
