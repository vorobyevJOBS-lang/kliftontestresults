export const REFERENCE_SCHEMA = "evidencehire-reference-v1";

export function emptyReferenceCheck() {
  return {
    disposition: "",
    consentConfirmed: false,
    recommenderNameRole: "",
    relationshipDates: "",
    answers: "",
    discrepancies: "",
    candidateExplanation: "",
    unavailableReason: "",
    legacyNotes: "",
  };
}

export function parseReferenceCheck(raw) {
  const fallback = emptyReferenceCheck();
  if (!raw?.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schema !== REFERENCE_SCHEMA || typeof parsed.data !== "object" || Array.isArray(parsed.data)) throw new Error("legacy");
    return { ...fallback, ...parsed.data };
  } catch {
    return { ...fallback, legacyNotes: raw };
  }
}

export function serializeReferenceCheck(value) {
  return JSON.stringify({ schema: REFERENCE_SCHEMA, data: value });
}

export function referenceDispositionComplete(raw) {
  const value = parseReferenceCheck(raw);
  if (value.disposition === "completed") {
    return value.consentConfirmed === true
      && value.recommenderNameRole.trim().length >= 5
      && value.relationshipDates.trim().length >= 5
      && value.answers.trim().length >= 20;
  }
  if (["unavailable", "not_applicable"].includes(value.disposition)) {
    return value.unavailableReason.trim().length >= 10;
  }
  return false;
}
