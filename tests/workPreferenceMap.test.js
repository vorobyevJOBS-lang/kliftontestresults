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

test("work preference result exposes rank hypotheses, never a fit score or verdict", () => {
  const result = buildWorkPreferenceMap(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("A"));
  assert.equal(result.topThemes.length, 5);
  assert.ok(result.topThemes.every((theme) => Number.isInteger(theme.selections) && theme.interviewQuestion));
  assert.ok(result.topThemes.every((theme) => theme.opportunities >= theme.selections && theme.relativeSelection >= 0 && theme.relativeSelection <= 1));
  assert.equal("fit" in result, false);
  assert.equal("score" in result, false);
  assert.equal("verdict" in result, false);
  assert.match(result.note, /не даёт процент соответствия/i);
});

test("malformed work preference answers fail closed", () => {
  assert.equal(buildWorkPreferenceMap([]), null);
  assert.equal(buildWorkPreferenceMap(null), null);
});
