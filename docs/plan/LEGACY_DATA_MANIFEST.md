# Legacy data manifest

Read-only production snapshot taken on 2026-08-06 before the 9/10 hardening work.
The digest is SHA-256 over ordered `to_jsonb(row)::text` values. It contains no PII
and is used only to detect an unexpected mutation of an existing row.

| Table | Rows | SHA-256 |
| --- | ---: | --- |
| `results` | 97 | `c68723a2f1cb4855e432e555ede5b4bf34dc49b52435b04f748b581ae28abe9a` |
| `tools_results` | 16 | `19fa3c208f00e09f5817704c7010ed42282d798dbe0be23a6541f726851ea744` |
| `rezultat_results` | 26 | `9da5469dbdddd543088d3ee71a27c6c76767fe2322e0c607348f322041a1e362` |
| `logis_results` | 6 | `dc857502f60aec5d69c2436d67929e5ef29ed5cc0079bd8c575018dfa3889135` |
| `sails_results` | 13 | `3a922a4d2d576f75abc403e77894ece31e4941fa912f32da195c5cd82af9aac1` |
| `prim_results` | 12 | `6b902316a9567ba4199daf8fa8092a6cc3b33e6c4c05d1b993dde0b5ad324756` |
| **Legacy result total** | **170** | n/a |
| `candidate_profiles` | 2 | `b32fe17d5ec31ea736a06f8886beee49d46e01df6d234763bcd79320fc5b29f7` |
| `candidate_activity` | 2 | `7500eeacb468985b86ed5f3bed3ea0c70c080f69ac97a66acde6e83efeada45c` |

## Required verification query

Run the same ordered digest query before and after a migration. New submissions may
increase a table row count; in that case the pre-existing rows must be checked by
their IDs against this checkpoint rather than comparing a whole-table digest.

The Supabase organization is currently on the Free plan. An in-database snapshot is
not an off-site backup. Before any migration that can alter result payloads, make a
logical `supabase db dump`/`pg_dump` export to encrypted off-site storage or upgrade
to a plan with automatic backups and test restoration.

## Encrypted logical copy

Created and decrypted successfully on 2026-08-06:

- encrypted payload: `../private-backups/evidencehire-legacy-2026-08-06.enc.json`;
- decryption key: `../private-backup-keys/evidencehire-legacy-2026-08-06.key`;
- encryption: AES-256-GCM;
- encrypted copy plaintext SHA-256:
  `40083e9a70d6209e5e8676037f54453d04f5f8c6066b8f2cb01405a8fa19aece`;
- file permissions: owner read/write only (`0600`).

The payload and key must be copied to separate secure locations. This local copy
protects the migration, but it is not a complete disaster-recovery strategy while
both artifacts remain on the same Mac.
