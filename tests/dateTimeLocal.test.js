import test from "node:test";
import assert from "node:assert/strict";
import { toDateTimeLocal } from "../src/hiring/dateTime.js";

test("datetime-local conversion preserves the instant on a save round trip", () => {
  const original = "2026-08-06T03:15:00.000Z";
  const local = toDateTimeLocal(original);
  assert.equal(new Date(local).toISOString(), original);
});

test("datetime-local conversion fails closed for invalid input", () => {
  assert.equal(toDateTimeLocal("not-a-date"), "");
  assert.equal(toDateTimeLocal(null), "");
});
