import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleRelevance } from "../src/hiring/roleRelevance.js";
import { WORK_PREFERENCE_QUESTION_COUNT } from "../src/hiring/workPreferenceMap.js";

test("role relevance ranks same-school roles and keeps the current vacancy visible", () => {
  const result = buildRoleRelevance(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("A"), "jobs_tutor");

  assert.ok(result.roles.length >= 3);
  assert.ok(result.roles.some((role) => role.profileId === "jobs_tutor" && role.current));
  assert.ok(result.roles.every((role) => role.profileId !== "school_administrator"));
  assert.ok(result.roles.every((role) => Number.isInteger(role.rank) && role.matchedThemes.length === 3));
  assert.ok(result.roles.every((role) => role.interviewQuestion && role.verification));
});

test("role relevance exposes no success percentage or hiring verdict", () => {
  const result = buildRoleRelevance(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("B"), "klyachka_enrollment_manager");
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /comparisonIndex|fit|score|verdict/i);
  assert.match(result.note, /не прогноз успеха/i);
});

test("role relevance fails closed for an incomplete preference map", () => {
  assert.equal(buildRoleRelevance(["A", "B"], "jobs_tutor"), null);
});
