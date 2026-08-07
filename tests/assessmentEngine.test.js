import test from "node:test";
import assert from "node:assert/strict";
import { assessmentAccessState, buildDecisionMatrix, calculateAssessment, calculateRaterAgreement, canCompareCandidates, clampRating, decisionReadiness, documentedEvidenceStatus, submittedRaterStatus, weightedAverage } from "../src/hiring/assessmentEngine.js";
import { getJobProfile, JOB_PROFILES } from "../src/hiring/jobProfiles.js";
import { buildVerificationGuidance } from "../src/hiring/hrGuidance.js";

test("rating accepts only integer values from 1 to 5", () => {
  assert.equal(clampRating(1), 1);
  assert.equal(clampRating("5"), 5);
  for (const value of [null, "", 0, 3.4, 6, 9, "no"]) assert.equal(clampRating(value), null);
});

test("weightedAverage refuses a set without valid evidence", () => {
  assert.equal(weightedAverage([{ score: 5, weight: 60 }, { score: 3, weight: 40 }]), 4.2);
  assert.equal(weightedAverage([{ score: null, weight: 60 }]), null);
});

test("draft profile never returns a magic score or recommendation", () => {
  const profile = getJobProfile("klyachka_enrollment_manager");
  const interview = Object.fromEntries(profile.interview.map((item) => [item.id, 5]));
  const sample = Object.fromEntries(profile.workSample.rubric.map((item) => [item.id, 5]));
  const result = calculateAssessment(profile, interview, sample);
  assert.equal(result.completion, 100);
  assert.equal(result.allRequiredMethodsComplete, true);
  assert.equal(result.overall, null);
  assert.equal(result.decision, "Доказательства собраны — профиль пока в пилоте");
});

test("missing either required method keeps evidence incomplete", () => {
  const profile = getJobProfile("school_administrator");
  const interview = Object.fromEntries(profile.interview.map((item) => [item.id, 4]));
  const result = calculateAssessment(profile, interview, {});
  assert.equal(result.methodStatus.structured_interview.complete, true);
  assert.equal(result.methodStatus.work_sample.complete, false);
  assert.equal(result.allRequiredMethodsComplete, false);
  assert.equal(result.overall, null);
});

test("all school profiles use unique stable IDs and cover every competency", () => {
  for (const profile of JOB_PROFILES) {
    assert.match(profile.workSample.observedFormat, /минут|наблюден|упражнен|симуляц/i);
    const ids = [...profile.interview.map((item) => item.id), ...profile.workSample.rubric.map((item) => item.id)];
    assert.equal(new Set(ids).size, ids.length, `${profile.id} has duplicate evidence IDs`);
    const covered = new Set([...profile.interview, ...profile.workSample.rubric].map((item) => item.competency));
    for (const competency of Object.keys(profile.competencies)) assert.equal(covered.has(competency), true, `${profile.id} misses ${competency}`);
  }
});

test("booking and trial-sale roles stay separate in both schools", () => {
  for (const [bookingId, trialId, schoolName] of [
    ["klyachka_enrollment_manager", "klyachka_trial_sales_manager", "Клячка"],
    ["jobs_enrollment_manager", "jobs_trial_sales_manager", "JOBS"],
  ]) {
    const booking = getJobProfile(bookingId);
    const trialSale = getJobProfile(trialId);
    assert.equal(booking.name, `Менеджер записи — ${schoolName}`);
    assert.equal(trialSale.name, `Менеджер пробного урока и продаж — ${schoolName}`);
    assert.equal(booking.kpis.some((item) => /60% входящих заявок записаны/i.test(item)), true);
    assert.equal(booking.kpis.some((item) => /60% записанных дошли/i.test(item)), true);
    assert.deepEqual(booking.kpiTargets.map((item) => item.target), [60, 60, 36]);
    assert.equal(booking.competencies.learning, 15);
    assert.equal(booking.interview.some((item) => item.id === "learning_feedback"), true);
    assert.equal(booking.workSample.rubric.some((item) => item.id === "booking_sample_learning"), true);
    assert.match(booking.workSample.observedFormat, /обратн.*связ|повтор/i);
    assert.match(booking.screening.find((item) => item.id === "attendance_result").label, /если опыта нет/i);
    assert.equal(booking.kpis.some((item) => /конверсия после пробного в оплату/i.test(item)), false);
    assert.equal(trialSale.kpis.some((item) => /конверсия после пробного в оплату/i.test(item)), true);
  }
});

test("Klyachka booking pilot draft contains the owner-confirmed 90-day standard", () => {
  const profile = getJobProfile("klyachka_enrollment_manager");
  assert.match(profile.jobAnalysisDraft.outcomeDefinition, /цель не ниже 36%/i);
  assert.match(profile.jobAnalysisDraft.outcomeDefinition, /запись \/ валидные входящие заявки ≥ 60%/i);
  assert.match(profile.jobAnalysisDraft.outcomeDefinition, /пришедшие \/ записи.*≥ 60%/i);
  assert.match(profile.jobAnalysisDraft.entryRequirements, /опыт.*не обязателен/i);
  assert.equal(profile.jobAnalysisDraft.reviewers.split("\n").length, 4);
});

test("school operations roles reflect real ownership boundaries", () => {
  const klyachkaAdmin = getJobProfile("school_administrator");
  const jobsRecords = getJobProfile("jobs_records_administrator");
  const tutor = getJobProfile("jobs_tutor");
  const teacher = getJobProfile("jobs_design_mentor");
  assert.equal(klyachkaAdmin.school, "klyachka");
  assert.match(klyachkaAdmin.name, /Клячка/);
  assert.equal(jobsRecords.school, "jobs");
  assert.match(jobsRecords.name, /делопроизводитель/i);
  assert.equal(tutor.school, "jobs");
  assert.equal(tutor.kpis.includes("продление обучения"), true);
  assert.equal(tutor.kpis.includes("корректное разрешение возвратов"), true);
  assert.equal(teacher.name, "Преподаватель дизайна — JOBS");
});

test("decision readiness requires two fully documented submitted raters", () => {
  const profile = getJobProfile("school_administrator");
  const ratings = {}, notes = {};
  for (const item of profile.interview) {
    ratings[`structured_interview:${item.id}`] = 3;
    notes[`structured_interview:${item.id}`] = "Конкретный наблюдаемый факт из ответа";
  }
  for (const item of profile.workSample.rubric) ratings[`work_sample:${item.id}`] = 3;
  notes["work_sample:reviewer_notes"] = "Наблюдаемая последовательность действий в симуляции";
  notes["work_sample:observer_attestation"] = "confirmed";
  const rater = { raterId: "one", submittedAt: new Date().toISOString(), ratings, notes };
  assert.equal(submittedRaterStatus(profile, rater).complete, true);
  assert.equal(decisionReadiness(profile, { raterEvidence: [rater] }).ready, false);
  assert.equal(decisionReadiness(profile, { raterEvidence: [rater, { ...rater }] }).ready, false, "one person cannot count twice");
  assert.equal(decisionReadiness(profile, { raterEvidence: [rater, { ...rater, raterId: "two" }] }).ready, true);
});

test("decision matrix keeps both submitted scores and documented facts per criterion", () => {
  const profile = getJobProfile("school_administrator");
  const makeRater = (raterId, score, fact) => {
    const ratings = {}, notes = {};
    for (const item of profile.interview) {
      ratings[`structured_interview:${item.id}`] = score;
      notes[`structured_interview:${item.id}`] = `${fact}: факт из ответа`;
    }
    for (const item of profile.workSample.rubric) ratings[`work_sample:${item.id}`] = score;
    notes["work_sample:reviewer_notes"] = `${fact}: наблюдаемые действия в симуляции`;
    notes["work_sample:observer_attestation"] = "confirmed";
    return { raterId, submittedAt: "2026-08-06T00:00:00.000Z", ratings, notes };
  };
  const first = makeRater("one", 1, "Первый оценщик");
  const second = makeRater("two", 5, "Второй оценщик");
  const matrix = buildDecisionMatrix(profile, { raterEvidence: [first, second] });
  assert.equal(matrix.raters.length, 2);
  assert.equal(matrix.rows.length, profile.interview.length + profile.workSample.rubric.length);
  assert.deepEqual(matrix.rows[0].evidence.map((item) => item.score), [1, 5]);
  assert.match(matrix.rows[0].evidence[0].facts, /Первый оценщик/);
  assert.match(matrix.rows[0].evidence[1].facts, /Второй оценщик/);
  assert.equal(matrix.rows[0].range, 4);
  assert.equal(matrix.rows[0].needsCalibration, true);
});

test("access modes keep interviewer blind while owner can decide without a fake rating", () => {
  const owner = assessmentAccessState({ profileStatus: "pilot", submittedReady: true, currentSubmitted: false, canManageCrm: true, canDecide: true, canReviewSubmittedWithoutOwnRating: true });
  assert.deepEqual(owner, { decisionReady: true, decisionViewer: true, blindRating: false, ratingLocked: true });

  const adminBeforeSubmit = assessmentAccessState({ profileStatus: "pilot", submittedReady: true, currentSubmitted: false, canManageCrm: true, canDecide: true, canReviewSubmittedWithoutOwnRating: false });
  assert.deepEqual(adminBeforeSubmit, { decisionReady: false, decisionViewer: false, blindRating: false, ratingLocked: false });

  const adminAfterSubmit = assessmentAccessState({ ...adminBeforeSubmit, profileStatus: "pilot", submittedReady: true, currentSubmitted: true, canManageCrm: true, canDecide: true, canReviewSubmittedWithoutOwnRating: false });
  assert.equal(adminAfterSubmit.decisionReady, true);
  assert.equal(adminAfterSubmit.ratingLocked, true);

  const interviewer = assessmentAccessState({ profileStatus: "pilot", submittedReady: false, currentSubmitted: false, canManageCrm: false, canDecide: false, canReviewSubmittedWithoutOwnRating: false });
  assert.deepEqual(interviewer, { decisionReady: false, decisionViewer: false, blindRating: true, ratingLocked: false });
});

test("documentation requires interview facts, observed notes and attestation", () => {
  const profile = getJobProfile("school_administrator");
  const candidate = {
    interviewNotes: Object.fromEntries(profile.interview.map((item) => [item.id, "Факт из ответа кандидата"])),
    workSampleNotes: "Наблюдаемые действия в рабочей симуляции",
    observedConfirmed: false,
  };
  assert.equal(documentedEvidenceStatus(profile, candidate).complete, false);
  assert.equal(documentedEvidenceStatus(profile, { ...candidate, observedConfirmed: true }).complete, true);
});

test("validated score requires a versioned frozen scoring plan", () => {
  const base = getJobProfile("school_administrator");
  const interview = Object.fromEntries(base.interview.map((item) => [item.id, 5]));
  const sample = Object.fromEntries(base.workSample.rubric.map((item) => [item.id, 5]));
  assert.equal(calculateAssessment({ ...base, status: "validated", scoringPlan: { competencyWeights: base.competencies } }, interview, sample).overall, null);
  const frozen = { ...base, status: "validated", scoringPlan: { version: base.version, frozenAt: "2026-08-06T00:00:00.000Z", competencyWeights: base.competencies } };
  assert.equal(calculateAssessment(frozen, interview, sample).overall, 5);
});

test("unknown profiles fail visibly instead of falling back to sales", () => {
  assert.throws(() => getJobProfile("unknown-profile"), /Неизвестный профиль/);
});

test("comparison requires the same complete profile version and branch", () => {
  const base = { profileId: "school_administrator", profileVersion: 1, branchId: "jobs_design", evidenceComplete: true };
  assert.equal(canCompareCandidates(base, { ...base }), true);
  assert.equal(canCompareCandidates(base, { ...base, profileVersion: 2 }), false);
  assert.equal(canCompareCandidates(base, { ...base, branchId: "klyachka_nvkz" }), false);
  assert.equal(canCompareCandidates(base, { ...base, evidenceComplete: false }), false);
});

test("large disagreement between raters requires calibration", () => {
  assert.deepEqual(calculateRaterAgreement([2, 4]), { range: 2, needsCalibration: true });
  assert.deepEqual(calculateRaterAgreement([4, 5]), { range: 1, needsCalibration: false });
  assert.equal(calculateRaterAgreement([4]), null);
});

test("verification guidance highlights missing and weak evidence without an automatic verdict", () => {
  const profile = getJobProfile("school_administrator");
  const sample = { [profile.workSample.rubric[0].id]: 2 };
  const result = calculateAssessment(profile, {}, sample);
  const guidance = buildVerificationGuidance(profile, result);
  assert.ok(guidance.missing.length > 0);
  assert.equal(guidance.weak.length, 1);
  assert.match(guidance.scenario, /расписан|занят/i);
  assert.equal(guidance.probes.length, 3);
});
