export function clampRating(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
}

export function weightedAverage(entries) {
  const valid = entries.filter((entry) => Number.isFinite(entry.score) && Number.isFinite(entry.weight) && entry.weight > 0);
  const weight = valid.reduce((sum, entry) => sum + entry.weight, 0);
  if (!weight) return null;
  return valid.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / weight;
}

function required(items) {
  return items.filter((item) => item.required !== false);
}

function completedRequired(items, ratings) {
  return required(items).filter((item) => clampRating(ratings[item.id]) != null).length;
}

function hasText(value, minimum) {
  return typeof value === "string" && value.trim().length >= minimum;
}

export function documentedEvidenceStatus(profile, candidate) {
  const missing = [];
  for (const item of required(profile.interview || [])) {
    if (!hasText(candidate?.interviewNotes?.[item.id], 10)) missing.push(`факты интервью: ${item.id}`);
  }
  if (!hasText(candidate?.workSampleNotes, 20)) missing.push("наблюдения по рабочей пробе");
  if (candidate?.observedConfirmed !== true) missing.push("подтверждение наблюдаемой рабочей пробы");
  return { complete: missing.length === 0, missing };
}

export function submittedRaterStatus(profile, rater) {
  if (!rater?.submittedAt) return { complete: false, missing: ["оценка не завершена"] };
  const missing = [];
  for (const item of required(profile.interview || [])) {
    const key = `structured_interview:${item.id}`;
    if (![1, 3, 5].includes(clampRating(rater.ratings?.[key]))) missing.push(`оценка интервью: ${item.id}`);
    if (!hasText(rater.notes?.[key], 10)) missing.push(`факты интервью: ${item.id}`);
  }
  for (const item of required(profile.workSample?.rubric || [])) {
    const key = `work_sample:${item.id}`;
    if (![1, 3, 5].includes(clampRating(rater.ratings?.[key]))) missing.push(`оценка пробы: ${item.id}`);
  }
  if (!hasText(rater.notes?.["work_sample:reviewer_notes"], 20)) missing.push("наблюдения по рабочей пробе");
  if (rater.notes?.["work_sample:observer_attestation"] !== "confirmed") missing.push("подтверждение наблюдаемой рабочей пробы");
  return { complete: missing.length === 0, missing };
}

export function completeSubmittedRaters(profile, candidate) {
  const raters = new Map();
  for (const rater of candidate?.raterEvidence || []) {
    if (!rater?.raterId || raters.has(rater.raterId) || !submittedRaterStatus(profile, rater).complete) continue;
    raters.set(rater.raterId, rater);
  }
  return [...raters.values()];
}

export function decisionReadiness(profile, candidate, minimumRaters = 2) {
  const raters = completeSubmittedRaters(profile, candidate);
  return {
    ready: raters.length >= minimumRaters,
    completeRaters: raters.length,
    minimumRaters,
    raters,
  };
}

export function buildDecisionMatrix(profile, candidate) {
  const raters = completeSubmittedRaters(profile, candidate).map((rater, index) => ({
    ...rater,
    label: `Оценщик ${index + 1}`,
  }));
  const items = [
    ...(profile.interview || []).map((item) => ({
      id: `structured_interview:${item.id}`,
      method: "structured_interview",
      label: item.text,
      competency: item.competency,
    })),
    ...(profile.workSample?.rubric || []).map((item) => ({
      id: `work_sample:${item.id}`,
      method: "work_sample",
      label: item.criterion,
      competency: item.competency,
    })),
  ];
  const rows = items.map((item) => {
    const evidence = raters.map((rater) => ({
      raterId: rater.raterId,
      label: rater.label,
      score: clampRating(rater.ratings?.[item.id]),
      facts: rater.notes?.[item.id]
        || (item.method === "work_sample" ? rater.notes?.["work_sample:reviewer_notes"] : "")
        || "",
    }));
    const scores = evidence.map((entry) => entry.score).filter((score) => score != null);
    const range = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
    return { ...item, evidence, range, needsCalibration: range >= 2 };
  });
  return { raters: raters.map(({ raterId, label, submittedAt }) => ({ raterId, label, submittedAt })), rows };
}

export function assessmentAccessState({ profileStatus, submittedReady, currentSubmitted, canManageCrm, canDecide, canReviewSubmittedWithoutOwnRating }) {
  const decisionReady = profileStatus !== "draft"
    && submittedReady === true
    && (currentSubmitted === true || canReviewSubmittedWithoutOwnRating === true);
  const decisionViewer = canDecide === true && decisionReady && currentSubmitted !== true;
  return {
    decisionReady,
    decisionViewer,
    blindRating: canManageCrm !== true && currentSubmitted !== true,
    ratingLocked: currentSubmitted === true || decisionViewer,
  };
}

export function calculateAssessment(profile, interviewRatings = {}, workSampleRatings = {}) {
  if (!profile?.id || !Array.isArray(profile.interview) || !Array.isArray(profile.workSample?.rubric)) {
    throw new Error("Некорректный профиль должности.");
  }

  const byCompetency = {};
  const evidence = [];
  const addEvidence = (method, item, score) => {
    if (score == null) return;
    byCompetency[item.competency] ||= [];
    byCompetency[item.competency].push({ score, source: method, id: item.id });
    evidence.push({ method, competency: item.competency, score, id: item.id });
  };

  profile.interview.forEach((item) => addEvidence("structured_interview", item, clampRating(interviewRatings[item.id])));
  profile.workSample.rubric.forEach((item) => {
    if (!item.id) throw new Error(`У критерия рабочей пробы нет стабильного ID: ${item.criterion || "без названия"}`);
    addEvidence("work_sample", item, clampRating(workSampleRatings[item.id]));
  });

  const requiredInterview = required(profile.interview);
  const requiredWorkSample = required(profile.workSample.rubric);
  const interviewCompleted = completedRequired(profile.interview, interviewRatings);
  const workSampleCompleted = completedRequired(profile.workSample.rubric, workSampleRatings);
  const requiredTotal = requiredInterview.length + requiredWorkSample.length;
  const completedTotal = interviewCompleted + workSampleCompleted;
  const completion = requiredTotal ? Math.round((completedTotal / requiredTotal) * 100) : 0;
  const methodStatus = {
    structured_interview: { completed: interviewCompleted, required: requiredInterview.length, complete: interviewCompleted === requiredInterview.length },
    work_sample: { completed: workSampleCompleted, required: requiredWorkSample.length, complete: workSampleCompleted === requiredWorkSample.length },
  };

  const competencyScores = Object.entries(profile.competencies || {}).map(([id, weight]) => {
    const rows = byCompetency[id] || [];
    const score = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : null;
    return { id, weight, score, evidenceCount: rows.length };
  });
  const allRequiredMethodsComplete = (profile.requiredMethods || ["work_sample", "structured_interview"])
    .every((method) => methodStatus[method]?.complete);
  const frozenWeights = profile.scoringPlan?.competencyWeights;
  const scoringPlanIsFrozen = profile.status === "validated"
    && profile.scoringPlan?.version === (profile.version || 1)
    && typeof profile.scoringPlan?.frozenAt === "string"
    && frozenWeights
    && Object.keys(profile.competencies || {}).every((id) => Number.isFinite(frozenWeights[id]) && frozenWeights[id] > 0);
  const canCalculateValidatedScore = scoringPlanIsFrozen && allRequiredMethodsComplete;
  const overall = canCalculateValidatedScore
    ? weightedAverage(competencyScores.map((row) => ({ score: row.score, weight: frozenWeights[row.id] })))
    : null;

  let decision = "Соберите обязательные доказательства";
  if (allRequiredMethodsComplete && profile.status !== "validated") decision = "Доказательства собраны — профиль пока в пилоте";
  if (allRequiredMethodsComplete && profile.status === "validated") decision = "Доказательства собраны — решение принимает комиссия";

  return {
    overall: overall == null ? null : Number(overall.toFixed(2)),
    completion,
    completedTotal,
    requiredTotal,
    methodStatus,
    allRequiredMethodsComplete,
    competencyScores,
    evidence,
    decision,
    profileStatus: profile.status,
  };
}

export function calculateRaterAgreement(ratings) {
  const values = ratings.map(clampRating).filter((value) => value != null);
  if (values.length < 2) return null;
  const range = Math.max(...values) - Math.min(...values);
  return { range, needsCalibration: range >= 2 };
}

export function canCompareCandidates(first, second) {
  if (!first || !second) return false;
  return first.profileId === second.profileId
    && (first.profileVersion || 1) === (second.profileVersion || 1)
    && (first.branchId || "") === (second.branchId || "")
    && first.evidenceComplete === true
    && second.evidenceComplete === true;
}

export function createCandidateRecord({ name, email, profileId, profileVersion = 1, branchId = "", candidateModules = [] }) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    email: email.trim(),
    profileId,
    profileVersion,
    branchId,
    candidateModules: [...new Set(candidateModules)].filter((module) => module === "work_preferences_fc"),
    status: "assessment",
    pipelineStage: "new",
    nextAction: "",
    nextActionAt: "",
    rejectionReason: "",
    source: "",
    createdAt: new Date().toISOString(),
    interviewRatings: {},
    interviewNotes: {},
    workSampleRatings: {},
    workSampleNotes: "",
    observedConfirmed: false,
    referenceNotes: "",
    referenceOriginalNotes: "",
  };
}
