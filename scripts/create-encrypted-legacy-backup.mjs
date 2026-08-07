import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(projectRoot, "..");
const backupDir = resolve(process.env.EVIDENCEHIRE_BACKUP_DIR || workspaceRoot, "private-backups");
const keyDir = resolve(process.env.EVIDENCEHIRE_KEY_DIR || workspaceRoot, "private-backup-keys");
const backupPath = resolve(backupDir, "evidencehire-legacy-2026-08-06.enc.json");
const keyPath = resolve(keyDir, "evidencehire-legacy-2026-08-06.key");

const supabaseUrl = process.env.SUPABASE_URL || "https://pnoislxcidkfhnkpawpj.supabase.co";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";
const supabase = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });

const tables = [
  ["results", "id", 97],
  ["tools_results", "id", 16],
  ["rezultat_results", "id", 26],
  ["logis_results", "id", 6],
  ["sails_results", "id", 13],
  ["prim_results", "id", 12],
  ["candidate_profiles", "candidate_key", 2],
  ["candidate_activity", "id", 2],
];

async function assertMissing(path) {
  try {
    const handle = await open(path, "wx", 0o600);
    await handle.close();
    return;
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Refusing to overwrite existing backup artifact: ${path}`);
    throw error;
  }
}

async function main() {
  const payload = {
    format: "evidencehire-legacy-v1",
    projectRef: "pnoislxcidkfhnkpawpj",
    createdAt: new Date().toISOString(),
    tables: {},
  };

  for (const [table, orderColumn, expectedCount] of tables) {
    const { data, error } = await supabase.from(table).select("*").order(orderColumn, { ascending: true }).limit(1000);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data.length !== expectedCount) {
      throw new Error(`${table}: expected ${expectedCount} rows, received ${data.length}; aborting backup`);
    }
    payload.tables[table] = data;
  }

  const plaintext = Buffer.from(JSON.stringify(payload));
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const envelope = {
    format: "evidencehire-encrypted-backup-v1",
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    plaintextSha256: createHash("sha256").update(plaintext).digest("hex"),
    counts: Object.fromEntries(Object.entries(payload.tables).map(([table, rows]) => [table, rows.length])),
    ciphertext: ciphertext.toString("base64"),
  };

  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  await mkdir(keyDir, { recursive: true, mode: 0o700 });
  await assertMissing(backupPath);
  await assertMissing(keyPath);
  await writeFile(backupPath, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });
  await writeFile(keyPath, `${key.toString("hex")}\n`, { mode: 0o600 });

  console.log(JSON.stringify({
    backupPath,
    keyPath,
    counts: envelope.counts,
    plaintextSha256: envelope.plaintextSha256,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
