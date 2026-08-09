import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { QUESTIONS } from "../src/questions.js";
import { buildWorkPreferenceMap, validWorkPreferenceAnswers, WORK_PREFERENCE_BANK_SHA256, WORK_PREFERENCE_QUESTION_COUNT } from "../src/hiring/workPreferenceMap.js";

test("versioned work preference bank is immutable", () => {
  assert.equal(createHash("sha256").update(JSON.stringify(QUESTIONS)).digest("hex"), WORK_PREFERENCE_BANK_SHA256);
});

test("work preference map requires exactly one valid answer per pair", () => {
  assert.equal(validWorkPreferenceAnswers(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("A")), true);
  assert.equal(validWorkPreferenceAnswers(Array(WORK_PREFERENCE_QUESTION_COUNT - 1).fill("A")), false);
  assert.equal(validWorkPreferenceAnswers([...Array(WORK_PREFERENCE_QUESTION_COUNT - 1).fill("A"), "X"]), false);
  assert.equal(validWorkPreferenceAnswers(["A", "B"], { complete: false }), true);
});

test("work preference result exposes a full explainable narrative without a hiring verdict", () => {
  const result = buildWorkPreferenceMap(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("A"));
  assert.equal(result.topThemes.length, 5);
  assert.equal(result.rankedThemes.length, 20);
  assert.equal(result.strengths.length, 5);
  assert.equal(result.pitfalls.length, 5);
  assert.equal(result.watchpoints.length, 5);
  assert.match(result.portrait, /рабочая гипотеза/i);
  assert.equal(result.responseCheck.checkedPairs, 20);
  assert.ok(result.topThemes.every((theme) => Number.isInteger(theme.rank) && Number.isInteger(theme.preferenceIndex) && theme.interviewQuestion));
  assert.ok(result.topThemes.every((theme) => theme.opportunities >= theme.selections && theme.relativeSelection >= 0 && theme.relativeSelection <= 1));
  assert.equal("fit" in result, false);
  assert.equal("score" in result, false);
  assert.equal("verdict" in result, false);
  assert.match(result.note, /не используется для автоматического отказа/i);
  assert.equal(result.responseCheck.label, "справочный технический показатель");
  assert.match(result.responseCheck.note, /не имеет валидированных порогов/i);
});

test("malformed work preference answers fail closed", () => {
  assert.equal(buildWorkPreferenceMap([]), null);
  assert.equal(buildWorkPreferenceMap(null), null);
});
