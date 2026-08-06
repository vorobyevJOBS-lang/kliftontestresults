# EvidenceHire project contract

- Product: hiring tests and an HR CRM for the Klyachka art schools and JOBS design school.
- Users: candidates, branch HR/managers, and the owner with full access.
- Current goal: reliable evidence-based hiring with strict branch-scoped access.
- Non-goals: automated hire/reject decisions and unsupported psychometric claims.
- Stack: React 18, Vite 8, Supabase Auth/Postgres/RLS, Vercel.
- Key code: `src/HiringPlatform.jsx`, `src/CandidatePortal.jsx`, `src/hiring/`, `api/`.
- Database changes: idempotent root-level SQL migration files; preserve legacy result tables.
- Branch IDs: `klyachka_nvkz`, `klyachka_krsk_center`, `klyachka_krsk_vzlet`, `jobs_design`.
- Build: `npm run build`
- Tests: `node --test tests/*.test.js`
- Security check: `npm audit --omit=dev`; verify RLS for every new public table.
- Deploy: GitHub `main` auto-deploys to `https://kliftontestresults.vercel.app/`.
- Known risks: legacy tables use a protected server endpoint; psychometric validity requires real 30/60/90-day outcome data.
