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
