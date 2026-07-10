export function clampRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(1, Math.min(5, Math.round(number)));
}

export function weightedAverage(entries) {
  const valid = entries.filter((entry) => Number.isFinite(entry.score) && Number.isFinite(entry.weight) && entry.weight > 0);
  const weight = valid.reduce((sum, entry) => sum + entry.weight, 0);
  if (!weight) return null;
  return valid.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / weight;
}

export function calculateAssessment(profile, interviewRatings = {}, workSampleRatings = {}) {
  const byCompetency = {};
  const evidence = [];

  profile.interview.forEach((question) => {
    const score = clampRating(interviewRatings[question.id]);
    if (score == null) return;
    byCompetency[question.competency] ||= [];
    byCompetency[question.competency].push({ score, source: "interview", id: question.id });
    evidence.push({ method: "Структурированное интервью", competency: question.competency, score, id: question.id });
  });

  profile.workSample.rubric.forEach((item, index) => {
    const id = `${profile.id}-rubric-${index}`;
    const score = clampRating(workSampleRatings[id]);
    if (score == null) return;
    byCompetency[item.competency] ||= [];
    byCompetency[item.competency].push({ score, source: "work_sample", id });
    evidence.push({ method: "Рабочая проба", competency: item.competency, score, id });
  });

  const competencyScores = Object.entries(profile.competencies).map(([id, weight]) => {
    const rows = byCompetency[id] || [];
    const work = rows.filter((row) => row.source === "work_sample");
    const interview = rows.filter((row) => row.source === "interview");
    const score = weightedAverage([
      ...(work.length ? [{ score: work.reduce((sum, row) => sum + row.score, 0) / work.length, weight: 60 }] : []),
      ...(interview.length ? [{ score: interview.reduce((sum, row) => sum + row.score, 0) / interview.length, weight: 40 }] : []),
    ]);
    return { id, weight, score, evidenceCount: rows.length };
  });

  const overall = weightedAverage(competencyScores.filter((row) => row.score != null).map((row) => ({ score: row.score, weight: row.weight })));
  const completion = Math.round((competencyScores.filter((row) => row.score != null).reduce((sum, row) => sum + row.weight, 0) /
    Object.values(profile.competencies).reduce((sum, weight) => sum + weight, 0)) * 100);

  const hasSufficientCoverage = completion >= 70;
  return {
    overall: overall == null || !hasSufficientCoverage ? null : Math.round(overall * 20),
    completion,
    competencyScores,
    evidence,
    decision: overall == null || !hasSufficientCoverage
      ? "Недостаточно данных"
      : overall >= 4.2 ? "Сильные подтверждённые сигналы"
      : overall >= 3.4 ? "Достаточные сигналы для следующего этапа"
      : overall >= 2.6 ? "Смешанные сигналы — требуется дополнительная проверка"
      : "Недостаточно подтверждений по критериям роли",
  };
}

export function calculateRaterAgreement(ratings) {
  const values = ratings.map(clampRating).filter((value) => value != null);
  if (values.length < 2) return null;
  const range = Math.max(...values) - Math.min(...values);
  return { range, needsCalibration: range >= 2 };
}

export function createCandidateRecord({ name, email, profileId }) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    email: email.trim(),
    profileId,
    status: "assessment",
    createdAt: new Date().toISOString(),
    interviewRatings: {},
    interviewNotes: {},
    workSampleRatings: {},
    workSampleNotes: "",
  };
}
