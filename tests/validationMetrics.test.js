import test from "node:test";
import assert from "node:assert/strict";
import { pearsonCorrelation } from "../src/hiring/validationMetrics.js";

test("pearsonCorrelation detects a perfect positive relation", () => {
  assert.ok(Math.abs(pearsonCorrelation([[1, 2], [2, 4], [3, 6]]) - 1) < 1e-10);
});

test("pearsonCorrelation refuses tiny or constant samples", () => {
  assert.equal(pearsonCorrelation([[1, 1], [2, 2]]), null);
  assert.equal(pearsonCorrelation([[1, 2], [1, 3], [1, 4]]), null);
});
