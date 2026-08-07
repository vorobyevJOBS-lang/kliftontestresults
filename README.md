# EvidenceHire

Hiring CRM and candidate work-sample flow for the JOBS design school and the
Klyachka art schools. The active product uses job analysis, observed work samples,
structured interviews and two independent ratings. Historical questionnaires are
preserved as a read-only archive. The former 166-pair role questionnaire is an
optional rank-only work preference pilot inside a secure candidate invitation;
it never affects a decision automatically.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the public Supabase URL/key. The
service-role key is server-only and belongs in Vercel environment variables.

## Verification

```bash
npm run check
npm audit --omit=dev
```

For UI changes, also verify `/`, `/hr`, `/candidate?token=invalid`, and `/privacy`
at desktop and 390×844 viewport sizes.

## Production

- GitHub `main` is deployed automatically by Vercel.
- Production: <https://kliftontestresults.vercel.app/>
- HR workspace: <https://kliftontestresults.vercel.app/hr>
- Database: Supabase with Auth, RLS and capability-token candidate invitations.

Do not apply superseded SQL files. Apply `p0_hiring_security_and_archive.sql`,
then `p1_legacy_archive_rpc.sql`. P0 guards legacy row counts and fingerprints
inside its transaction; P1 exposes only branch-scoped authenticated archive RPCs.

## Operating documents

- [HR workflow](docs/HR_OPERATIONS_RUNBOOK.md)
- [Evidence methods](docs/EVIDENCE_METHODS.md)
- [Implementation and release gates](docs/plan/HIRING_9_10_IMPLEMENTATION.md)
- [Legacy data fingerprints](docs/plan/LEGACY_DATA_MANIFEST.md)
- [hh.ru integration readiness](docs/plan/HH_INTEGRATION.md)

No assessment can guarantee a successful hire. Draft and pilot profiles must not
be presented as validated predictors; local 30/60/90-day outcomes are required.
