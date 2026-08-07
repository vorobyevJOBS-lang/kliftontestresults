import test from "node:test";
import assert from "node:assert/strict";
import legacyHandler from "../api/supabase.js";

test("legacy candidate-result endpoint is retired", () => {
  let statusCode = 0;
  let payload = null;
  const response = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
  };
  legacyHandler({}, response);
  assert.equal(statusCode, 410);
  assert.match(payload.error.message, /Старые тесты выведены/);
});
