# Loom walkthrough script (target: 2:30–2:50)

**0:00–0:20 — Context**  
“Maria raised three issues: due dates shift across time zones, clinics need a message when work is ready, and the dashboard is cluttered. I kept this MVP focused on those three outcomes.”

**0:20–0:55 — Dashboard**  
Show the summary counts, search/status filter, case table, and overdue label. Point out that status is written in text as well as indicated by colour.

**0:55–1:25 — Date decision**  
“Due dates are calendar dates, not moments in time. I keep them as `YYYY-MM-DD` / database `DATE` and render the components directly. I do not parse midnight UTC and then convert it into the viewer’s time zone, and I did not patch the bug by adding or subtracting a day.”

**1:25–2:00 — Ready + email**  
Mark an in-progress case Ready. Click Notify. Show the generated recipient, subject and message. State clearly that test mode creates a preview and does not deliver an email. A provider key on its own does not change that: this demo has no database configured, so it always previews. Only if you also configure Supabase-backed data and a real provider may you demonstrate the live path, and only say it sent if the provider confirms.

**2:00–2:35 — Trade-off**  
“One decision I’d change with more time is to create an immutable notification history table with provider IDs, deduplication keys and delivery attempts. For this timebox I kept the workflow small and made test mode explicit, but production needs better auditability and retry handling.”

**2:35–2:50 — Close**  
Summarize what is complete and what remains: account configuration, confirmation of business time-zone rules, and WhatsApp only after email is validated.
