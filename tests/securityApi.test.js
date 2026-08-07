import test from "node:test";
import assert from "node:assert/strict";
import legacyHandler from "../api/supabase.js";
import legacyArchiveHandler from "../api/evidence-legacy.js";

function invoke(handler) {
  let statusCode = 0;
  let payload = null;
  const response = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
  };
  handler({}, response);
  return { statusCode, payload };
}

test("legacy candidate-result endpoint is retired", () => {
  const { statusCode, payload } = invoke(legacyHandler);
  assert.equal(statusCode, 410);
  assert.match(payload.error.message, /Старые тесты выведены/);
});

test("legacy server archive endpoint is retired", () => {
  const { statusCode, payload } = invoke(legacyArchiveHandler);
  assert.equal(statusCode, 410);
  assert.match(payload.error.message, /Старый серверный архив отключён/);
});
