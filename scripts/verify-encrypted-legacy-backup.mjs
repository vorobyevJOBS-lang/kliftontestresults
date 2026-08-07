import { createDecipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(projectRoot, "..");
const backupPath = process.argv[2] || resolve(workspaceRoot, "private-backups/evidencehire-legacy-2026-08-06.enc.json");
const keyPath = process.argv[3] || resolve(workspaceRoot, "private-backup-keys/evidencehire-legacy-2026-08-06.key");

const envelope = JSON.parse(await readFile(backupPath, "utf8"));
if (envelope.format !== "evidencehire-encrypted-backup-v1" || envelope.algorithm !== "aes-256-gcm") {
  throw new Error("Unsupported backup format");
}

const key = Buffer.from((await readFile(keyPath, "utf8")).trim(), "hex");
const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
const plaintext = Buffer.concat([
  decipher.update(Buffer.from(envelope.ciphertext, "base64")),
  decipher.final(),
]);
const digest = createHash("sha256").update(plaintext).digest("hex");
if (digest !== envelope.plaintextSha256) throw new Error("Backup checksum mismatch");

const payload = JSON.parse(plaintext.toString("utf8"));
const counts = Object.fromEntries(Object.entries(payload.tables || {}).map(([table, rows]) => [table, rows.length]));
if (JSON.stringify(counts) !== JSON.stringify(envelope.counts)) throw new Error("Backup row counts mismatch");

console.log(JSON.stringify({ verified: true, createdAt: payload.createdAt, counts, plaintextSha256: digest }, null, 2));
