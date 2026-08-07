import { QUESTIONS } from "../questions.js";
import { TALENTS } from "../talents.js";
import { TALENT_META } from "../talentMeta.js";

export const WORK_PREFERENCE_MODULE = "work_preferences_fc";
export const WORK_PREFERENCE_SCHEMA = "work-preferences-fc-legacy-166-v1";
export const WORK_PREFERENCE_BANK_SHA256 = "33c2f9e6f716b90029912db46899b6c02de82ea43f5d9a5ced9119986ec6ea1b";
export const WORK_PREFERENCE_QUESTION_COUNT = QUESTIONS.length;

export function validWorkPreferenceAnswers(answers, { complete = true } = {}) {
  if (!Array.isArray(answers)) return false;
  if (complete ? answers.length !== QUESTIONS.length : answers.length > QUESTIONS.length) return false;
  return answers.every((answer) => answer === "A" || answer === "B");
}

export function buildWorkPreferenceMap(answers) {
  if (!validWorkPreferenceAnswers(answers)) return null;

  const counts = Object.fromEntries(Object.keys(TALENTS).map((id) => [id, 0]));
  const opportunities = Object.fromEntries(Object.keys(TALENTS).map((id) => [id, 0]));
  QUESTIONS.forEach((question, index) => {
    opportunities[question.talentA] += 1;
    opportunities[question.talentB] += 1;
    counts[answers[index] === "A" ? question.talentA : question.talentB] += 1;
  });

  const ranked = Object.entries(counts)
    .map(([id, selections]) => ({
      id,
      name: TALENTS[id]?.name || id,
      selections,
      opportunities: opportunities[id],
      relativeSelection: opportunities[id] ? selections / opportunities[id] : 0,
      interviewQuestion: TALENT_META[id]?.iq || "Приведите недавний рабочий пример, который подтверждает эту гипотезу.",
    }))
    .sort((first, second) => second.relativeSelection - first.relativeSelection || second.selections - first.selections || first.name.localeCompare(second.name, "ru"));

  return {
    schema: WORK_PREFERENCE_SCHEMA,
    itemBankSha256: WORK_PREFERENCE_BANK_SHA256,
    topThemes: ranked.slice(0, 5),
    note: "Это относительная карта выбранных рабочих предпочтений внутри одного ответа. Она не измеряет способности, не даёт процент соответствия должности и не используется для автоматического отказа.",
  };
}
