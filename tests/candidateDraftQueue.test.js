import assert from "node:assert/strict";
import test from "node:test";
import { createSerialDraftQueue, hasCurrentConsent } from "../src/hiring/candidateDraftQueue.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("serial draft queue restores a reverted value after an older save finishes", async () => {
  const firstSave = deferred();
  const calls = [];
  const queue = createSerialDraftQueue(async (payload) => {
    calls.push(payload);
    if (payload === "intermediate") await firstSave.promise;
  }, "original");

  const intermediate = queue.enqueue("intermediate");
  await Promise.resolve();
  const reverted = queue.enqueue("original");
  firstSave.resolve();
  await Promise.all([intermediate, reverted]);

  assert.deepEqual(calls, ["intermediate", "original"]);
  assert.equal(queue.lastSaved(), "original");
});

test("serial draft queue retries an ambiguous failed save even for the previous value", async () => {
  let attempts = 0;
  const queue = createSerialDraftQueue(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("connection lost");
  }, "original");

  await assert.rejects(queue.enqueue("changed"));
  await queue.enqueue("original");
  assert.equal(attempts, 2);
  assert.equal(queue.lastSaved(), "original");
});

test("unfinished draft reuses consent only for the current notice version", () => {
  assert.equal(hasCurrentConsent({ consent_at: "2026-01-01", consent_notice: { version: "old" } }, "current"), false);
  assert.equal(hasCurrentConsent({ consent_at: "2026-01-01", consent_notice: { version: "current" } }, "current"), true);
  assert.equal(hasCurrentConsent({ submitted_at: "2026-01-02", consent_notice: { version: "old" } }, "current"), true);
});
