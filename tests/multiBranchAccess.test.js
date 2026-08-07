import test from "node:test";
import assert from "node:assert/strict";
import { expandLegacyBranchIds, getAllowedBranches } from "../api/evidence-legacy.js";

test("combines the primary branch with explicit branch grants without duplicates", () => {
  assert.deepEqual(getAllowedBranches(
    { branch_id: "klyachka_krsk_center" },
    [{ branch_id: "klyachka_krsk_center" }, { branch_id: "klyachka_krsk_vzlet" }],
  ), ["klyachka_krsk_center", "klyachka_krsk_vzlet"]);
});

test("owner-style membership without a primary branch remains unfiltered", () => {
  assert.deepEqual(getAllowedBranches({ branch_id: null }, []), []);
});

test("archive expands the canonical JOBS branch to the legacy alias", () => {
  assert.deepEqual(expandLegacyBranchIds(["jobs_design"]), ["jobs_design", "jobs_main"]);
});
