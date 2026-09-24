// Full encrypted logical backup: legacy archive + current hiring CRM.
//
// Requires p3_result_preservation_and_backup.sql. Signs in as the owner (the
// only role allowed to export), checks legacy fingerprints against
// docs/plan/LEGACY_DATA_MANIFEST.md and always writes the backup, even when a
// check fails, so a copy exists before anyone investigates.
//
//   EVIDENCEHIRE_OWNER_EMAIL=... EVIDENCEHIRE_OWNER_PASSWORD=... \
//     node scripts/create-encrypted-full-backup.mjs
//
// Store the .enc.json file and the .key file in two different places.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(projectRoot, "..");
const backupDir = resolve(process.env.EVIDENCEHIRE_BACKUP_DIR || workspaceRoot, "private-backups");
const keyDir = resolve(process.env.EVIDENCEHIRE_KEY_DIR || workspaceRoot, "private-backup-keys");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(backupDir, `evidencehire-full-${stamp}.enc.json`);
const keyPath = resolve(keyDir, `evidencehire-full-${stamp}.key`);

const supabaseUrl = process.env.SUPABASE_URL || "https://pnoislxcidkfhnkpawpj.supabase.co";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";

// Legacy tables are append-only and no longer receive submissions, so the
// 2026-08-06 manifest must match exactly.
export const LEGACY_MANIFEST = {
  results: { rows: 97, sha256: "c68723a2f1cb4855e432e555ede5b4bf34dc49b52435b04f748b581ae28abe9a" },
  tools_results: { rows: 16, sha256: "19fa3c208f00e09f5817704c7010ed42282d798dbe0be23a6541f726851ea744" },
  rezultat_results: { rows: 26, sha256: "9da5469dbdddd543088d3ee71a27c6c76767fe2322e0c607348f322041a1e362" },
  logis_results: { rows: 6, sha256: "dc857502f60aec5d69c2436d67929e5ef29ed5cc0079bd8c575018dfa3889135" },
  sails_results: { rows: 13, sha256: "3a922a4d2d576f75abc403e77894ece31e4941fa912f32da195c5cd82af9aac1" },
  prim_results: { rows: 12, sha256: "6b902316a9567ba4199daf8fa8092a6cc3b33e6c4c05d1b993dde0b5ad324756" },
  candidate_profiles: { rows: 2, sha256: "b32fe17d5ec31ea736a06f8886beee49d46e01df6d234763bcd79320fc5b29f7" },
  candidate_activity: { rows: 2, sha256: "7500eeacb468985b86ed5f3bed3ea0c70c080f69ac97a66acde6e83efeada45c" },
};

export function compareLegacyToManifest(legacyReport) {
  return Object.entries(LEGACY_MANIFEST).flatMap(([table, expected]) => {
    const actual = legacyReport?.[table];
    if (!actual) return [`${table}: missing from integrity report`];
    const problems = [];
    if (Number(actual.rows) !== expected.rows) problems.push(`${table}: expected ${expected.rows} rows, found ${actual.rows}`);
    if (actual.sha256 !== expected.sha256) problems.push(`${table}: content fingerprint differs from manifest`);
    return problems;
  });
}

async function assertMissing(path) {
  const handle = await open(path, "wx", 0o600).catch((error) => {
    if (error.code === "EEXIST") throw new Error(`Refusing to overwrite existing backup artifact: ${path}`);
    throw error;
  });
  await handle.close();
}

async function main() {
  const email = process.env.EVIDENCEHIRE_OWNER_EMAIL;
  const password = process.env.EVIDENCEHIRE_OWNER_PASSWORD;
  if (!email || !password) throw new Error("Set EVIDENCEHIRE_OWNER_EMAIL and EVIDENCEHIRE_OWNER_PASSWORD");

  const supabase = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Owner sign-in failed: ${signInError.message}`);

  const { data: report, error: reportError } = await supabase.rpc("get_data_integrity_report");
  if (reportError) throw new Error(`Integrity report failed (is P3 applied?): ${reportError.message}`);
  const { data: payload, error: exportError } = await supabase.rpc("export_owner_backup");
  if (exportError) throw new Error(`Export failed: ${exportError.message}`);
  await supabase.auth.signOut();

  const counts = Object.fromEntries(Object.entries(payload.tables).map(([table, rows]) => [table, rows.length]));
  const problems = compareLegacyToManifest(report.legacy);
  for (const [table, expected] of Object.entries(LEGACY_MANIFEST)) {
    if (counts[table] !== expected.rows) problems.push(`${table}: exported ${counts[table]} rows, manifest has ${expected.rows}`);
  }

  const plaintext = Buffer.from(JSON.stringify({ ...payload, integrity: report }));
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = {
    format: "evidencehire-encrypted-backup-v1",
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    plaintextSha256: createHash("sha256").update(plaintext).digest("hex"),
    counts,
    ciphertext: ciphertext.toString("base64"),
  };

  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  await mkdir(keyDir, { recursive: true, mode: 0o700 });
  await assertMissing(backupPath);
  await assertMissing(keyPath);
  await writeFile(backupPath, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });
  await writeFile(keyPath, `${key.toString("hex")}\n`, { mode: 0o600 });

  console.log(JSON.stringify({ backupPath, keyPath, counts, plaintextSha256: envelope.plaintextSha256, legacyIntact: problems.length === 0, problems }, null, 2));
  if (problems.length) {
    console.error("Backup written, but legacy data differs from the manifest. Do not run migrations; investigate first.");
    process.exitCode = 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
