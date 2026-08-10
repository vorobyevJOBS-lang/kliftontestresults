import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../p2_candidate_submission_multiline_fix.sql", import.meta.url), "utf8");
const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

test("P2 validates the whole multi-line plan and leaves candidate rows untouched", () => {
  assert.match(normalized, /create or replace function app_private\.candidate_response_is_valid/);
  assert.match(sql, /1234567890123456789\\nПродолжение плана/);
  assert.match(normalized, /complete multi-line plan was rejected/);
  assert.match(normalized, /short full plan was accepted/);
  assert.match(normalized, /empty verification was accepted/);
  assert.match(normalized, /complete 166-answer response was rejected/);
  assert.doesNotMatch(normalized, /split_part\(split_part\(work_sample, '\[ключевые детали\]', 1\), e'\\n', 2\)/);
  assert.doesNotMatch(normalized, /\b(update|insert into|delete from|truncate)\s+public\.(candidates|assessments|assessment_invites)\b/);
  assert.match(normalized, /revoke all on function app_private\.candidate_response_is_valid\(text, text\[\], boolean\) from public, anon, authenticated, service_role/);
  assert.match(normalized, /^--[\s\S]* begin; set local lock_timeout/);
  assert.match(normalized, /commit;$/);
});
