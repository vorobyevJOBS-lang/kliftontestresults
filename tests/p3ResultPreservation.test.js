import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareLegacyToManifest, LEGACY_MANIFEST } from "../scripts/create-encrypted-full-backup.mjs";

const sql = readFileSync(new URL("../p3_result_preservation_and_backup.sql", import.meta.url), "utf8");
// Drop SQL comments and join adjacent string literals ('a ' 'b' -> 'a b').
const normalized = sql.replace(/--[^\n]*/g, "").replace(/'\s*\n\s*'/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const manifest = readFileSync(new URL("../docs/plan/LEGACY_DATA_MANIFEST.md", import.meta.url), "utf8");

test("P3 never rewrites or deletes stored rows", () => {
  assert.doesNotMatch(normalized, /\b(delete from|truncate table|drop table|alter table [^;]+ drop column)\b/);
  assert.doesNotMatch(normalized, /\bupdate public\./);
  assert.match(normalized, /evidencehire p3 aborted: public\.% changed during migration/);
});

test("P3 makes the legacy 360 tables append-only and blocks CRM hard deletes", () => {
  assert.match(normalized, /foreach protected_table in array array\['candidate_profiles', 'candidate_activity'\]/);
  assert.match(normalized, /before update or delete or truncate on public\.%i for each statement execute function app_private\.block_legacy_result_mutation\(\)/);
  for (const table of ["assessment_invites", "assessment_evidence", "outcome_followups", "candidate_notes", "audit_events"]) {
    assert.match(normalized, new RegExp(`'${table}'`));
  }
  assert.match(normalized, /before delete or truncate on public\.%i for each statement execute function app_private\.block_hiring_record_deletion\(\)/);
});

test("P3 freezes a submitted candidate response", () => {
  assert.match(normalized, /if old\.submitted_at is not null and \( new\.candidate_response is distinct from old\.candidate_response/);
  assert.match(normalized, /before update on public\.assessment_invites for each row execute function app_private\.protect_submitted_candidate_response\(\)/);
});

test("P3 export and integrity report are owner-only and hide invitation token hashes", () => {
  assert.match(normalized, /where m\.user_id = caller_id and m\.role::text = 'owner'/);
  assert.match(normalized, /to_jsonb\(i\) - 'token_hash'/);
  assert.match(normalized, /grant execute on function public\.export_owner_backup\(\) to authenticated/);
  assert.match(normalized, /grant execute on function public\.get_data_integrity_report\(\) to authenticated/);
  assert.doesNotMatch(normalized, /grant execute[^;]+to anon/);
  assert.doesNotMatch(normalized, /'admins'/);
});

test("backup manifest matches the documented legacy fingerprints", () => {
  for (const [table, expected] of Object.entries(LEGACY_MANIFEST)) {
    assert.match(manifest, new RegExp(`\\| \`${table}\` \\| ${expected.rows} \\| \`${expected.sha256}\` \\|`));
  }
  const intact = Object.fromEntries(Object.entries(LEGACY_MANIFEST).map(([table, value]) => [table, { ...value }]));
  assert.deepEqual(compareLegacyToManifest(intact), []);
  intact.results = { rows: 96, sha256: "changed" };
  delete intact.prim_results;
  assert.deepEqual(compareLegacyToManifest(intact), [
    "results: expected 97 rows, found 96",
    "results: content fingerprint differs from manifest",
    "prim_results: missing from integrity report",
  ]);
});
