import test from "node:test";
import assert from "node:assert/strict";
import { calculateAssessment, calculateRaterAgreement, clampRating, weightedAverage } from "../src/hiring/assessmentEngine.js";
import { getJobProfile } from "../src/hiring/jobProfiles.js";

test("clampRating accepts only the 1–5 scale", () => {
  assert.equal(clampRating(0), 1);
  assert.equal(clampRating(3.4), 3);
  assert.equal(clampRating(9), 5);
  assert.equal(clampRating("no"), null);
});

test("weightedAverage ignores missing evidence", () => {
  assert.equal(weightedAverage([{ score: 5, weight: 60 }, { score: 3, weight: 40 }]), 4.2);
  assert.equal(weightedAverage([{ score: null, weight: 60 }]), null);
});

test("assessment does not show a decision without sufficient coverage", () => {
  const result = calculateAssessment(getJobProfile("sales"), {}, {});
  assert.equal(result.overall, null);
  assert.equal(result.completion, 0);
  assert.equal(result.decision, "Недостаточно данных");
});

test("work sample contributes more than interview for the same competency", () => {
  const profile = {
    id: "test",
    competencies: { ownership: 100 },
    interview: [{ id: "q", competency: "ownership" }],
    workSample: { rubric: [{ competency: "ownership" }] },
  };
  const result = calculateAssessment(profile, { q: 1 }, { "test-rubric-0": 5 });
  assert.equal(result.competencyScores[0].score, 3.4);
  assert.equal(result.overall, 68);
});

test("large disagreement between raters requires calibration", () => {
  assert.deepEqual(calculateRaterAgreement([2, 4]), { range: 2, needsCalibration: true });
  assert.deepEqual(calculateRaterAgreement([4, 5]), { range: 1, needsCalibration: false });
  assert.equal(calculateRaterAgreement([4]), null);
});
