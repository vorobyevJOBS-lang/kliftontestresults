# EvidenceHire 9/10 implementation plan

## Outcome

Build one hiring workspace for JOBS and Klyachka that helps managers collect
job-related evidence, run the same structured process for comparable candidates,
and review the quality of a hire after 30/60/90 days. The product must not make an
automatic hire/reject decision or present an unvalidated score as a diagnosis.

## Non-negotiable data rule

- Preserve every existing legacy result byte-for-byte.
- Never run `drop`, `truncate`, or physical `delete` against a legacy result table.
- Link legacy rows to the new CRM through an additive reference table.
- Match automatically only by normalized verified email. A name-only match always
  requires owner review.
- Re-run `docs/plan/LEGACY_DATA_MANIFEST.md` fingerprints before and after every
  production migration.

## Target workflow

1. HR creates a candidate, chooses branch and an approved school-specific role.
2. The platform creates a token-only invitation. PII never appears in its URL.
3. The candidate completes a short screening and role-specific work sample.
4. A manager scores the same observable criteria with 1/3/5 anchors.
5. The manager conducts a structured interview using the profile question set.
6. The product shows evidence coverage and unresolved checks, not a magic fit score.
7. A human records a decision and job-related reason.
8. For a hire, the manager records the agreed KPI at 30/60/90 days.

## Initial roles

- Klyachka enrollment and sales manager.
- JOBS enrollment and sales manager.
- School administrator.
- Klyachka drawing teacher.
- JOBS design teacher or mentor.
- Sales/call-center lead.
- Branch manager.

Promoter and supervisor profiles remain out of the default catalog until actively
needed. Generic developer, analyst, marketing and support profiles are not part of
this product.

## Evidence methods

### Default

- Job analysis with managers and strong incumbents.
- A 15-30 minute representative work sample or role-play.
- Four to six structured behavioral/situational interview questions.
- A predefined rubric with observable 1/3/5 anchors.
- Structured reference checking when job relevant and consented.

### Optional pilot methods

- A role-specific situational judgment test (SJT) written from real critical
  incidents and reviewed by subject-matter experts.
- A short public-domain personality scale only when a documented job analysis
  establishes relevance. It remains separate from the decision and cannot create
  a cut score before local validation.
- Cognitive or logic testing only for roles whose critical tasks genuinely require
  it, with standardized timing, accessibility and local outcome validation.

### Not allowed

- Unsupported personality labels or mental-health/addiction inferences.
- The current Profile test as a hiring filter.
- A Clifton/Gallup implication without a license.
- Automatic rejection from one questionnaire or an unvalidated combined score.

## Product structure

Primary navigation: Today, Candidates, Roles, Hiring quality, Settings.

Active pipeline: New, Contact, Assignment, Interview, Decision, Offer.
Closed outcomes: Hired, Reserve, Declined, Archived.

The Today screen prioritizes overdue actions, completed assignments awaiting review,
upcoming interviews and decisions. Legacy results live in the candidate card under
"Previous methodology" and never affect the decision automatically.

## Delivery gates

### Gate 0: safety

- Immutable in-database snapshot plus off-site logical backup.
- No anon read/update/delete on legacy or admin tables.
- No plaintext/unsalted legacy password authentication.
- No production fallback session secret.
- Soft delete and audit trail for new CRM data.

### Gate 1: unified data

- Stable candidate identity and legacy links.
- Canonical branch IDs and owner-reviewed unknown branches.
- Branch-scoped access proven by automated tests.

### Gate 2: evidence workflow

- School-specific roles and versioned profiles.
- Token-only assignment flow, autosave and completion states.
- Evidence coverage and independent ratings.

### Gate 3: UX and quality

- Mobile list navigation at 390x844 with 44px touch targets.
- End-to-end creation, assignment, submission, review and decision tests.
- Accessibility, failure/retry, refresh/resume and archive-preservation tests.
- Production monitoring for starts, completions, abandonment and client errors.

## Definition of 9/10

Security, data resilience and UX can reach 9/10 after the gates above and a tested
restore. Predictive validity cannot honestly be rated 9/10 until profile-specific
30/60/90-day outcomes have been collected and reviewed by a qualified organizational
psychology specialist. Until then the interface must show `Draft` or `Pilot`.
