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
  assert.ok(result.roles.every((role) => Number.isInteger(role.matchIndex) && role.matchIndex >= 0 && role.matchIndex <= 100));
  assert.ok(result.roles.every((role) => role.interviewQuestion && role.verification));
  assert.ok(result.allRoles.length >= result.roles.length);
});

test("role relevance labels the index as a within-profile hypothesis, never a success probability", () => {
  const result = buildRoleRelevance(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("B"), "klyachka_enrollment_manager");
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /comparisonIndex|successProbability|verdict/i);
  assert.match(result.note, /не процент вероятности успеха/i);
  assert.match(result.note, /не проходной балл/i);
});

test("role relevance fails closed for an incomplete preference map", () => {
  assert.equal(buildRoleRelevance(["A", "B"], "jobs_tutor"), null);
});

test("roles with the same match index share the same rank", () => {
  const result = buildRoleRelevance(Array(WORK_PREFERENCE_QUESTION_COUNT).fill("A"), "school_administrator");
  const byIndex = new Map();
  result.allRoles.forEach((role) => {
    if (byIndex.has(role.matchIndex)) assert.equal(role.rank, byIndex.get(role.matchIndex));
    else byIndex.set(role.matchIndex, role.rank);
  });
});
