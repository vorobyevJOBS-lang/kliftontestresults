import assert from "node:assert/strict";
import test from "node:test";
import { refreshCanApply, saveCardThenOutcomes } from "../src/hiring/saveCoordination.js";

test("a refresh result is rejected after a local edit starts", () => {
  assert.equal(refreshCanApply(7, 7), true);
  assert.equal(refreshCanApply(7, 8), false);
});

test("new assessment timestamp is applied before a later outcome failure", async () => {
  let appliedTimestamp = "";
  await assert.rejects(saveCardThenOutcomes({
    saveCard: async () => ({ updatedAt: "new-timestamp" }),
    onCardSaved: (saved) => { appliedTimestamp = saved.updatedAt; },
    outcomeDays: [30],
    saveCheckpoint: async () => { throw new Error("invalid outcome"); },
  }));
  assert.equal(appliedTimestamp, "new-timestamp");
});
