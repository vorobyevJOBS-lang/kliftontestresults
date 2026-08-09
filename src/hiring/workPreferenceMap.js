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
      domain: TALENTS[id]?.domain || "Без домена",
      description: TALENTS[id]?.description || "",
      selections,
      opportunities: opportunities[id],
      relativeSelection: opportunities[id] ? selections / opportunities[id] : 0,
      preferenceIndex: opportunities[id] ? Math.round((selections / opportunities[id]) * 100) : 0,
      strength: TALENT_META[id]?.plus || "",
      risk: TALENT_META[id]?.risk || "",
      pitfall: TALENT_META[id]?.pitfall || "",
      watch: TALENT_META[id]?.watch || "",
      interviewQuestion: TALENT_META[id]?.iq || "Приведите недавний рабочий пример, который подтверждает эту гипотезу.",
    }))
    .sort((first, second) => second.relativeSelection - first.relativeSelection || second.selections - first.selections || first.name.localeCompare(second.name, "ru"))
    .map((theme, index) => ({ ...theme, rank: index + 1 }));

  const mainCounts = Object.fromEntries(Object.keys(TALENTS).map((id) => [id, 0]));
  const mainOpportunities = Object.fromEntries(Object.keys(TALENTS).map((id) => [id, 0]));
  QUESTIONS.forEach((question, index) => {
    if (question.validation) return;
    mainOpportunities[question.talentA] += 1;
    mainOpportunities[question.talentB] += 1;
    mainCounts[answers[index] === "A" ? question.talentA : question.talentB] += 1;
  });
  const mainPreference = Object.fromEntries(Object.keys(TALENTS).map((id) => [
    id,
    mainOpportunities[id] ? mainCounts[id] / mainOpportunities[id] : 0,
  ]));
  const validationQuestions = QUESTIONS.filter((question) => question.validation);
  const repeatedPairMatches = validationQuestions.reduce((matches, question) => {
    const answer = answers[QUESTIONS.indexOf(question)];
    const difference = mainPreference[question.talentA] - mainPreference[question.talentB];
    if (Math.abs(difference) <= 0.05) return matches + 1;
    return matches + (answer === (difference > 0 ? "A" : "B") ? 1 : 0);
  }, 0);
  const responseConsistency = validationQuestions.length
    ? Math.round((repeatedPairMatches / validationQuestions.length) * 100)
    : null;

  const domainScores = [...new Set(ranked.map((theme) => theme.domain))]
    .map((domain) => {
      const themes = ranked.filter((theme) => theme.domain === domain);
      return {
        domain,
        preferenceIndex: Math.round(themes.reduce((total, theme) => total + theme.preferenceIndex, 0) / themes.length),
      };
    })
    .sort((first, second) => second.preferenceIndex - first.preferenceIndex || first.domain.localeCompare(second.domain, "ru"));

  const topThemes = ranked.slice(0, 5);
  const topThree = topThemes.slice(0, 3);
  const portrait = `В ответах чаще проявляются ${topThree.map((theme) => theme.name.toLowerCase()).join(", ")}. ${topThree.map((theme) => theme.description).filter(Boolean).join(" ")} Это рабочая гипотеза: подтвердите её примерами и поведением в одинаковой практической ситуации.`;

  return {
    schema: WORK_PREFERENCE_SCHEMA,
    itemBankSha256: WORK_PREFERENCE_BANK_SHA256,
    rankedThemes: ranked,
    topThemes,
    bottomThemes: ranked.slice(-3).reverse(),
    domainScores,
    portrait,
    strengths: topThemes.map((theme) => ({ id: theme.id, name: theme.name, rank: theme.rank, text: theme.strength })),
    pitfalls: topThemes.map((theme) => ({ id: theme.id, name: theme.name, rank: theme.rank, text: theme.pitfall, question: theme.interviewQuestion })),
    watchpoints: topThemes.map((theme) => ({ id: theme.id, name: theme.name, rank: theme.rank, text: theme.watch })),
    responseCheck: {
      checkedPairs: validationQuestions.length,
      matchedPairs: repeatedPairMatches,
      consistencyIndex: responseConsistency,
      label: "справочный технический показатель",
      note: "Совпадение повторных пар не имеет валидированных порогов, не измеряет надёжность или честность и не используется в решении о найме.",
    },
    note: "Это относительная карта предпочтений внутри ответов одного человека. Она не измеряет способности и не используется для автоматического отказа.",
  };
}
