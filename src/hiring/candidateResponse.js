import { WORK_PREFERENCE_BANK_SHA256, WORK_PREFERENCE_SCHEMA } from "./workPreferenceMap.js";

export function parseCandidateResponse(value) {
  if (!value) return { screening: {}, workSample: "", workPreferenceAnswers: [] };
  try {
    const parsed = JSON.parse(value);
    if (parsed?.schema === "evidencehire-candidate-v1" && typeof parsed.workSample === "string") {
      return {
        screening: parsed.screening && typeof parsed.screening === "object" ? parsed.screening : {},
        workSample: parsed.workSample,
        workPreferenceAnswers: parsed.rolePreferences?.schema === WORK_PREFERENCE_SCHEMA
          && parsed.rolePreferences?.itemBankSha256 === WORK_PREFERENCE_BANK_SHA256
          && Array.isArray(parsed.rolePreferences?.answers)
          ? parsed.rolePreferences.answers.filter((answer) => answer === "A" || answer === "B")
          : [],
      };
    }
  } catch {
    // Historical invitations stored a plain-text work sample.
  }
  return { screening: {}, workSample: String(value), workPreferenceAnswers: [] };
}

const responseTimestamp = (invite) => new Date(invite?.submitted_at || invite?.draft_updated_at || invite?.created_at || 0).getTime() || 0;

export function latestWorkPreferenceProgress(invites = []) {
  const latest = [...invites]
    .filter((invite) => invite?.candidate_response)
    .sort((first, second) => responseTimestamp(second) - responseTimestamp(first))[0];
  if (!latest) return { answers: [], updatedAt: "", submitted: false };
  return {
    answers: parseCandidateResponse(latest.candidate_response).workPreferenceAnswers,
    updatedAt: latest.submitted_at || latest.draft_updated_at || latest.created_at || "",
    submitted: Boolean(latest.submitted_at),
  };
}
