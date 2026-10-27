# Build and verification status

- TypeScript/TSX syntax parse: passed in the authoring environment.
- Date-only smoke tests: passed for Asia/Kolkata, Europe/London, America/Los_Angeles, Pacific/Kiritimati and Pacific/Honolulu; overdue-boundary cases passed.
- Full Next.js build: not run here because package installation could not reach `registry.npmjs.org` in the authoring environment (`EAI_AGAIN`). Run `npm install` and `npm run build` locally or in Vercel before treating the app as deployed.
- Supabase and Resend paths require account credentials and have not been integration-tested in this environment.
