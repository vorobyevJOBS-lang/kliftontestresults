export function pearsonCorrelation(pairs) {
  const valid = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (valid.length < 3) return null;
  const meanX = valid.reduce((sum, [x]) => sum + x, 0) / valid.length;
  const meanY = valid.reduce((sum, [, y]) => sum + y, 0) / valid.length;
  const numerator = valid.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const denominator = Math.sqrt(
    valid.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0) *
    valid.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0)
  );
  return denominator ? numerator / denominator : null;
}

export function summarizeValidation(candidates, resolveProfile, checkpoint = 90) {
  const rows = candidates.map((candidate) => {
    const profile = resolveProfile(candidate.profileId);
    const outcome = candidate.outcomes?.[checkpoint];
    if (!profile || !outcome) return null;
    const { overall, completion } = profile ? (awaitlessAssessment(profile, candidate)) : {};
    const managerRating = outcome.managerRating === "" ? null : Number(outcome.managerRating);
    return { profileId: profile.id, overall, completion, managerRating, retained: outcome.retained === "" ? null : outcome.retained === "true" };
  }).filter(Boolean);
  const usable = rows.filter((row) => row.overall != null && Number.isFinite(row.managerRating));
  const correlation = pearsonCorrelation(usable.map((row) => [row.overall, row.managerRating]));
  return {
    totalCandidates: candidates.length,
    followedUp: rows.length,
    usable: usable.length,
    correlation,
    retentionKnown: rows.filter((row) => row.retained != null).length,
    retained: rows.filter((row) => row.retained === true).length,
    readiness: usable.length < 30 ? "insufficient" : usable.length < 100 ? "pilot" : "study",
  };
}

// Dependency injection without a circular import keeps statistical helpers easy to test.
let assessmentCalculator = null;
export function configureValidationCalculator(calculator) { assessmentCalculator = calculator; }
function awaitlessAssessment(profile, candidate) {
  if (!assessmentCalculator) return { overall: null, completion: 0 };
  return assessmentCalculator(profile, candidate.interviewRatings, candidate.workSampleRatings);
}
