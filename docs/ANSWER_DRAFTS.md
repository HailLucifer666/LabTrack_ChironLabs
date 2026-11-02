# Written answers — Chiron Labs FDE assignment

Drafted 2026-11-02 by Arghya Chowdhury. Facts come from shipped work (see CV) and from this repository. Keep every claim honest — this repo is a demo build; nothing here claims live production email or shared storage.

---

## Q1. Tell us about something you shipped end-to-end, including a trade-off you had to make.

**Answer.**

The strongest example is the OTT streaming platform backend I built from scratch as lead engineer at Herolabs Infotech (an FSZT Partners company), for a Latin American micro-drama app.

End-to-end means I owned the whole path: data model, API, security, testing, release procedure, and the operational hand-off. The service exposed a 50-endpoint REST API to a React Native mobile app. The PostgreSQL layer grew to 135 migrations, 51 tables and 79 row-level-security policies. I authored 81% of the repository's commits and 152 merged pull requests in a four-engineer team. The CI/CD pipeline ran a dependency-audit gate and a parallel real-database end-to-end job, and I cut CI image size 69% (8.4 GB to 2.6 GB). The suite reached roughly 1,900 unit tests and 109 Playwright end-to-end cases against a real Postgres database, with mutation testing used to prove the tests actually catch the defects they claim to guard.

The engineering story that matters most is one incident. A pre-launch outage on the shared environment showed me the release process itself was fragile. I introduced a migration-first release procedure with rollback proofs and live post-deploy checks — the fix was not more code, it was ordering: migrations must be forward-only, numbered, and proven reversible before the deploy moves on. That procedure then survived the actual launch.

The trade-off I'd call out: **I chose a speed-first, monolith-style architecture over a service-oriented one, and I deferred a durable audit/notification-history table.** The subscription and payment flows needed correctness more than scale: I fixed mixed-currency totals (INR 900 + USD 10 previously reported as USD 910), out-of-order subscription webhooks, non-idempotent payment events, and virtual-coin abuse — each proven with a regression test. A clean event-sourced ledger would have made some of those fixes simpler, but it would have delayed the launch; the decision was to ship a correct, tested, single-service system first and introduce the ledger when the product proved it needed the complexity. This exact trade-off appears again in my LabTrack take-home, where I kept the notification workflow minimal and test-mode explicit rather than building a full notification-history table in the timebox.

---

## Q2. A client gives you a vague request. What is your first step?

**Answer.**

My first step is never to write code. It is to **measure the premise before building on it** — I treat every vague request as a set of unverified claims about the customer's world, and my job is to convert ambiguity into a short list of decisions the customer can actually make.

Concretely, three moves, in order:

1. **Restate the goal in one sentence, and list what I don't know.** "You want the dashboard to feel less cluttered" is not a spec. I would say back: "You want the team to see, in under a few seconds, which cases need attention and what to do next — is that right?" Then I enumerate the unknowns that block a build: what "cluttered" means to them, which decisions they make each day, what a wrong answer costs.

2. **Ask two or three targeted questions — with options, never open-ended essay questions.** Options force the customer to choose, which surfaces their actual priorities in minutes instead of meetings. For example, for the LabTrack time-zone fix, the question was not "which time zone should we use?" — it was "should the lab's business date govern overdue labels, and is it Asia/Kolkata or another zone?" Offering defaults (a documented IANA zone, a demo mode) turns a vague wish into a decision.

3. **Build the smallest probe that renders the decision visible.** Before committing to a full build, I make the cheapest thing that shows the customer they were understood — a demo mode, a mock, a single screen. In the LabTrack take-home, the whole app runs in demo mode by design: browser-local data, explicit test-mode email previews, a clearly labelled "no email was delivered" notice. That means the client can react to the real shapes (dates, labels, email previews) without any infrastructure, and every later decision is made against something they have already seen.

The first step, then, is always the same: **convert the vague request into a one-sentence goal, a list of unknowns, and two or three option-based questions — before any code is written.** Code is the last step, not the first.

---

## Q3. Why this role, and why now?

**Answer.**

I am a self-taught engineer who builds software by directing AI coding agents — Claude Code primarily — and verifying everything they produce: test-first, adversarial checks, mutation proofs. That is exactly what a Forward Deployed Engineer is asked to do: work inside the customer's context, move fast, and be responsible for the outcome, not just the pull request. I want this role because it is the most honest version of what I already do: shipping working, tested software in a customer's environment, where the constraints are real and the feedback loop is days, not quarters.

Why now: I have just completed a six-month engagement as a Forward Deployed Engineer at Herolabs, where I took an OTT platform from a blank repository to a launch-ready service with 135 migrations, row-level security, 1,900 tests and a CI/CD pipeline — 81% of the commits, 152 merged PRs, four engineers. I have also built MYTHOS, a voice-first AI desktop assistant with 8,000+ automated tests and nine releases in fourteen weeks, and my own multi-agent AI engineering system with 25+ specialist agents in three orchestrated teams. The technical work is proven. What I want next is to apply that method inside a company where forward-deployed engineering is the product: Chiron Labs' FDE work matches my operating history — enterprise operations at HP, NVIDIA and Dell taught me SLAs, incidents and real customers; AI-agent engineering taught me how to build software at a pace that ops background alone never would. I am an immediate joiner and ready to start as soon as you need me.

---

## Q4. When can you start, and what are your salary expectations?

**Draft.**

- **Start date:** Immediate — I am an immediate joiner and currently fully available (remote, based in Bengaluru, India).
- **Salary expectation:** [STATE A NUMBER OR A RANGE HERE — shortlist a figure you are comfortable with, e.g. "USD 70,000–85,000 per year (or equivalent INR, remote)"]. If you prefer, I can also share my full compensation expectations in a first call rather than by email.

> **Before sending, replace the [STATE A NUMBER...] placeholder with your actual figure.** Everything else in Q4 is complete.
