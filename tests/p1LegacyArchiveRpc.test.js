import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../p1_legacy_archive_rpc.sql", import.meta.url));
const sql = readFileSync(path, "utf8").replace(/\s+/g, " ").toLowerCase();

test("legacy archive RPCs are authenticated and branch scoped", () => {
  assert.match(sql, /create or replace function public\.list_legacy_result_index\(\)/);
  assert.match(sql, /create or replace function public\.get_legacy_result_detail/);
  assert.match(sql, /caller_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql, /where branch_id = any\(\$1\)/);
  assert.match(sql, /and branch_id = any\(\$2\)/);
  assert.match(sql, /if caller_role = 'owner'/);
  assert.match(sql, /grant execute on function public\.list_legacy_result_index\(\) to authenticated/);
  assert.match(sql, /grant execute on function public\.get_legacy_result_detail\(text, text\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute[^;]+to anon/);
  assert.doesNotMatch(sql, /service_role_key|supabase_service_role_key/);
});

test("legacy detail table name is allowlisted before identifier formatting", () => {
  assert.match(sql, /target_table not in \('results','tools_results','rezultat_results','logis_results','sails_results','prim_results'\)/);
  assert.match(sql, /format\('select to_jsonb\(source\) from public\.%i source where id::text = \$1/);
});
