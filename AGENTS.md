# EvidenceHire project contract

- Product: hiring tests and an HR CRM for the Klyachka art schools and JOBS design school.
- Users: candidates, branch HR/managers, and the owner with full access.
- Current goal: reliable evidence-based hiring with strict branch-scoped access.
- Non-goals: automated hire/reject decisions and unsupported psychometric claims.
- External integrations: hh.ru integration is explicitly out of scope by owner decision (2026-08-07); do not implement or plan it unless the owner reverses this decision.
- Stack: React 18, Vite 8, Supabase Auth/Postgres/RLS, Vercel.
- Key code: `src/HiringPlatform.jsx`, `src/CandidatePortal.jsx`, `src/hiring/`, `api/`.
- Database changes: idempotent root-level SQL migration files; preserve legacy result tables. Production has `p0_hiring_security_and_archive.sql` and `p1_legacy_archive_rpc.sql` applied. Do not rerun older `*_schema.sql`, `branch_access_migration.sql`, or `fix_prim_results_visibility.sql`; they contain superseded broad grants/policies.
- Branch IDs: `klyachka_nvkz`, `klyachka_krsk_center`, `klyachka_krsk_vzlet`, `jobs_design`.
- Build: `npm run build`
- Tests: `npm test`
- Full local check: `npm run check`
- Security check: `npm audit --omit=dev`; verify RLS for every new public table.
- Deploy: GitHub `main` auto-deploys to `https://kliftontestresults.vercel.app/`.
- Production baseline (2026-08-07): all 170 legacy results remain preserved; branch-scoped archive RPCs are live; owner and four staff accounts have passed sign-in checks; an encrypted off-site export exists outside the repository.
- Operational gate: no pilot job profile has been owner-approved yet, so real candidate invitations must remain unavailable until a role is reviewed with managers and strong incumbents and saved as `pilot`.
- Known risks: Supabase Free has no automatic backups; 38 historical rows have no trustworthy branch and remain owner-only; legacy JOBS rows use `jobs_main` while the canonical branch ID is `jobs_design`; leaked-password protection must be enabled in Supabase Auth; Russian candidate data localization must be resolved before scaling; predictive validity requires real 30/60/90-day outcome data.
