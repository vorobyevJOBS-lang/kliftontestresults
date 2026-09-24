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

test("local draft copy restores only unsynced answers written on the current server version", async () => {
  const { chooseLocalDraft, clearLocalDraft, localDraftKey, readLocalDraft, writeLocalDraft, LOCAL_DRAFT_MAX_AGE_MS } = await import("../src/hiring/candidateDraftQueue.js");
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const key = await localDraftKey("a".repeat(64));
  assert.match(key, /^evidencehire-draft:[0-9a-f]{32}$/);
  assert.notEqual(key, await localDraftKey("b".repeat(64)));
  assert.doesNotMatch(key, /aaaa/);

  writeLocalDraft(storage, key, "local answers", "server v1", 1000);
  const entry = readLocalDraft(storage, key);
  assert.equal(chooseLocalDraft(entry, "server v1", false, 2000), "local answers");
  assert.equal(chooseLocalDraft(entry, "server v2 from another device", false, 2000), null);
  assert.equal(chooseLocalDraft(entry, "server v1", true, 2000), null);
  assert.equal(chooseLocalDraft(entry, "server v1", false, 1000 + LOCAL_DRAFT_MAX_AGE_MS + 1), null);
  assert.equal(chooseLocalDraft({ ...entry, payload: "server v1" }, "server v1", false, 2000), null);

  clearLocalDraft(storage, key);
  assert.equal(readLocalDraft(storage, key), null);
  storage.setItem(key, "{broken");
  assert.equal(readLocalDraft(storage, key), null);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(readLocalDraft(throwing, key), null);
  assert.doesNotThrow(() => writeLocalDraft(throwing, key, "x", ""));
  assert.doesNotThrow(() => clearLocalDraft(throwing, key));
});
