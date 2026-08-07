export const MIN_VALIDATION_SAMPLE = 30;

export function pearsonCorrelation(pairs, minimumSample = MIN_VALIDATION_SAMPLE) {
  const valid = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (valid.length < minimumSample) return null;
  const meanX = valid.reduce((sum, [x]) => sum + x, 0) / valid.length;
  const meanY = valid.reduce((sum, [, y]) => sum + y, 0) / valid.length;
  const numerator = valid.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const denominator = Math.sqrt(
    valid.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0) *
    valid.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0)
  );
  return denominator ? numerator / denominator : null;
}

export function pearsonConfidenceInterval(correlation, sampleSize) {
  if (!Number.isFinite(correlation) || sampleSize < MIN_VALIDATION_SAMPLE) return null;
  if (Math.abs(correlation) === 1) return [correlation, correlation];
  const fisher = Math.atanh(correlation);
  const margin = 1.96 / Math.sqrt(sampleSize - 3);
  return [Math.tanh(fisher - margin), Math.tanh(fisher + margin)];
}

export function summarizeValidation(candidates, resolveProfile, checkpoint = 90) {
  const rows = candidates.map((candidate) => {
    const profile = candidate.profileDefinition || resolveProfile(candidate.profileId);
    const outcome = candidate.outcomes?.[checkpoint];
    if (!profile) return null;
    const { overall, completion, allRequiredMethodsComplete } = awaitlessAssessment(profile, candidate);
    const managerRating = !outcome || outcome.managerRating === "" ? null : Number(outcome.managerRating);
    const kpiDefinition = (outcome?.kpiDefinition || "").trim();
    const kpiValue = !outcome || outcome.kpiValue === "" ? null : Number(outcome.kpiValue);
    const comparableKpi = Number.isFinite(kpiValue) && kpiDefinition.length >= 20 && (outcome?.notes || "").trim().length >= 20;
    return {
      profileId: profile.id,
      profileName: profile.name,
      profileVersion: candidate.profileVersion || profile.version || 1,
      profileStatus: profile.status,
      branchId: candidate.branchId || "unassigned",
      overall,
      completion,
      allRequiredMethodsComplete,
      hasFollowUp: Boolean(outcome),
      managerRating,
      outcomeValue: comparableKpi ? kpiValue : null,
      kpiDefinition: comparableKpi ? kpiDefinition : "not_comparable",
      retained: !outcome || outcome.retained === "" ? null : outcome.retained === "true",
    };
  }).filter(Boolean);
  const groupsMap = new Map();
  for (const row of rows) {
    const key = `${row.profileId}:v${row.profileVersion}:${row.branchId}:${row.kpiDefinition}`;
    const group = groupsMap.get(key) || {
      key,
      profileId: row.profileId,
      profileName: row.profileName,
      profileVersion: row.profileVersion,
      profileStatus: row.profileStatus,
      branchId: row.branchId,
      kpiDefinition: row.kpiDefinition,
      candidates: 0,
      completed: 0,
      followedUp: 0,
      usable: 0,
      correlation: null,
    };
    group.candidates += 1;
    if (row.allRequiredMethodsComplete) group.completed += 1;
    if (row.hasFollowUp) group.followedUp += 1;
    groupsMap.set(key, group);
  }
  const groups = [...groupsMap.values()].map((group) => {
    const groupRows = rows.filter((row) => `${row.profileId}:v${row.profileVersion}:${row.branchId}:${row.kpiDefinition}` === group.key);
    const usableRows = groupRows.filter((row) => row.overall != null && Number.isFinite(row.outcomeValue));
    const correlation = pearsonCorrelation(usableRows.map((row) => [row.overall, row.outcomeValue]));
    return {
      ...group,
      usable: usableRows.length,
      correlation,
      confidenceInterval: pearsonConfidenceInterval(correlation, usableRows.length),
    };
  });
  const usable = rows.filter((row) => row.overall != null && Number.isFinite(row.outcomeValue));
  return {
    totalCandidates: candidates.length,
    followedUp: rows.filter((row) => row.hasFollowUp).length,
    completed: rows.filter((row) => row.allRequiredMethodsComplete).length,
    usable: usable.length,
    correlation: groups.length === 1 ? groups[0].correlation : null,
    retentionKnown: rows.filter((row) => row.retained != null).length,
    retained: rows.filter((row) => row.retained === true).length,
    groups,
    readiness: usable.length ? "exploratory" : "not_ready",
  };
}

// Dependency injection without a circular import keeps statistical helpers easy to test.
let assessmentCalculator = null;
export function configureValidationCalculator(calculator) { assessmentCalculator = calculator; }
function awaitlessAssessment(profile, candidate) {
  if (!assessmentCalculator) return { overall: null, completion: 0 };
  return assessmentCalculator(profile, candidate.interviewRatings, candidate.workSampleRatings);
}
