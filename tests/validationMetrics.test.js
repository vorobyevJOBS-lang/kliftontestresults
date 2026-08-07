import test from "node:test";
import assert from "node:assert/strict";
import { configureValidationCalculator, MIN_VALIDATION_SAMPLE, pearsonConfidenceInterval, pearsonCorrelation, summarizeValidation } from "../src/hiring/validationMetrics.js";

test("pearsonCorrelation detects a perfect positive relation", () => {
  const pairs = Array.from({ length: MIN_VALIDATION_SAMPLE }, (_, index) => [index + 1, (index + 1) * 2]);
  const correlation = pearsonCorrelation(pairs);
  assert.ok(Math.abs(correlation - 1) < 1e-10);
  assert.deepEqual(pearsonConfidenceInterval(correlation, pairs.length), [1, 1]);
});

test("pearsonCorrelation refuses tiny or constant samples", () => {
  assert.equal(pearsonCorrelation([[1, 1], [2, 2]]), null);
  assert.equal(pearsonCorrelation(Array.from({ length: MIN_VALIDATION_SAMPLE }, (_, index) => [1, index])), null);
});

test("validation never combines different roles, versions or branches", () => {
  configureValidationCalculator(() => ({ overall: null, completion: 100, allRequiredMethodsComplete: true }));
  const profiles = {
    sales: { id: "sales", name: "Продажи", version: 1, status: "draft" },
    teacher: { id: "teacher", name: "Преподаватель", version: 1, status: "draft" },
  };
  const candidates = [
    { profileId: "sales", profileVersion: 1, branchId: "klyachka_nvkz", outcomes: { 90: { managerRating: 5, retained: "true" } } },
    { profileId: "sales", profileVersion: 2, branchId: "klyachka_nvkz", outcomes: { 90: { managerRating: 4, retained: "true" } } },
    { profileId: "teacher", profileVersion: 1, branchId: "jobs_design", outcomes: {} },
  ];
  const summary = summarizeValidation(candidates, (id) => profiles[id], 90);
  assert.equal(summary.groups.length, 3);
  assert.equal(summary.usable, 0);
  assert.equal(summary.correlation, null);
});
