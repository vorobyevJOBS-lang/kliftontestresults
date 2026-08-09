import test from "node:test";
import assert from "node:assert/strict";
import { activePipelineStage, pipelineColumnFor, pipelineStageLabel, PRIMARY_PIPELINE_STAGES, stageMatchesColumn } from "../src/hiring/pipelineStages.js";

test("the active CRM exposes exactly the five owner-approved stages", () => {
  assert.deepEqual(PRIMARY_PIPELINE_STAGES.map((stage) => stage.label), ["Новый", "Тест", "Предобучение", "Стажировка", "Оффер"]);
});

test("legacy stage tokens stay visible inside the new funnel without rewriting stored rows", () => {
  assert.equal(pipelineStageLabel("screening"), "Новый");
  assert.equal(pipelineStageLabel("testing"), "Тест");
  assert.equal(pipelineStageLabel("decision"), "Стажировка");
  assert.equal(pipelineStageLabel("references"), "Стажировка");
  assert.equal(stageMatchesColumn("decision", pipelineColumnFor("work_sample")), true);
  assert.equal(activePipelineStage("references"), true);
  assert.equal(activePipelineStage("declined"), false);
});

test("every primary and legacy funnel value is included in active CRM metrics", () => {
  PRIMARY_PIPELINE_STAGES.flatMap((stage) => stage.values).forEach((stageId) => {
    assert.equal(activePipelineStage(stageId), true, `${stageId} should be active`);
  });
});
