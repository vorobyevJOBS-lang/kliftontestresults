import test from "node:test";
import assert from "node:assert/strict";
import { getJobProfile } from "../src/hiring/jobProfiles.js";
import { pipelineMoveBlock } from "../src/hiring/pipelineMove.js";
import { serializeReferenceCheck } from "../src/hiring/referenceCheck.js";

const profile = getJobProfile("klyachka_trial_sales_manager");

function completeRater(raterId) {
  const ratings = {};
  const notes = {};
  for (const item of profile.interview) {
    ratings[`structured_interview:${item.id}`] = 3;
    notes[`structured_interview:${item.id}`] = "Наблюдаемый факт из структурированного ответа";
  }
  for (const item of profile.workSample.rubric) ratings[`work_sample:${item.id}`] = 3;
  notes["work_sample:reviewer_notes"] = "Наблюдаемые действия кандидата в стандартной рабочей пробе";
  notes["work_sample:observer_attestation"] = "confirmed";
  return { raterId, submittedAt: "2026-08-07T10:00:00Z", ratings, notes };
}

test("dragging stays free across operational stages but protects decisions", () => {
  const candidate = { finalDecision: "pending", raterEvidence: [] };
  for (const stage of ["new", "assignment", "interview"]) assert.equal(pipelineMoveBlock(candidate, profile, stage), "");
  assert.match(pipelineMoveBlock(candidate, profile, "decision"), /две полноценные/i);
  assert.match(pipelineMoveBlock(candidate, profile, "unknown"), /неизвестный/i);
});

test("offer drag requires submitted evidence, an offer decision and reference status", () => {
  const assessed = { raterEvidence: [completeRater("one"), completeRater("two")], finalDecision: "pending", referenceNotes: "" };
  assert.equal(pipelineMoveBlock(assessed, profile, "decision"), "");
  assert.match(pipelineMoveBlock(assessed, profile, "offer"), /решение комиссии/i);
  const decided = { ...assessed, finalDecision: "offer" };
  assert.match(pipelineMoveBlock(decided, profile, "offer"), /рекомендац/i);
  const referenceNotes = serializeReferenceCheck({
    disposition: "unavailable",
    consentConfirmed: false,
    recommenderNameRole: "",
    relationshipDates: "",
    answers: "",
    discrepancies: "",
    candidateExplanation: "",
    unavailableReason: "Кандидат впервые выходит на работу",
    legacyNotes: "",
  });
  assert.equal(pipelineMoveBlock({ ...decided, referenceNotes }, profile, "offer"), "");
});
