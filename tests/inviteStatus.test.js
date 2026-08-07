import test from "node:test";
import assert from "node:assert/strict";
import { deriveInviteProgress, summarizeInviteFunnel } from "../src/hiring/inviteStatus.js";

const future = "2026-08-10T00:00:00.000Z";
const now = new Date("2026-08-07T00:00:00.000Z").getTime();

test("invite progress distinguishes created, opened and in-progress assignments", () => {
  assert.equal(deriveInviteProgress([], now).status, "none");
  assert.equal(deriveInviteProgress([{ created_at: "2026-08-06T00:00:00Z", expires_at: future }], now).status, "created");
  assert.equal(deriveInviteProgress([{ created_at: "2026-08-06T00:00:00Z", opened_at: "2026-08-06T01:00:00Z", expires_at: future }], now).status, "opened");
  assert.equal(deriveInviteProgress([{ created_at: "2026-08-06T00:00:00Z", opened_at: "2026-08-06T01:00:00Z", draft_updated_at: "2026-08-06T02:00:00Z", expires_at: future }], now).status, "in_progress");
});

test("submitted evidence wins over a newer revoked invitation", () => {
  const progress = deriveInviteProgress([
    { created_at: "2026-08-07T03:00:00Z", revoked_at: "2026-08-07T04:00:00Z", expires_at: future },
    { created_at: "2026-08-06T00:00:00Z", submitted_at: "2026-08-06T04:00:00Z", expires_at: future },
  ], now);
  assert.equal(progress.status, "submitted");
  assert.equal(progress.submittedAt, "2026-08-06T04:00:00Z");
});

test("expired and revoked invitations require a fresh link", () => {
  assert.equal(deriveInviteProgress([{ created_at: "2026-08-01T00:00:00Z", expires_at: "2026-08-06T00:00:00Z" }], now).status, "expired");
  assert.equal(deriveInviteProgress([{ created_at: "2026-08-06T00:00:00Z", expires_at: future, revoked_at: "2026-08-06T01:00:00Z" }], now).status, "expired");
});

test("invite funnel keeps assignment, start and completion denominators explicit", () => {
  const funnel = summarizeInviteFunnel([
    { inviteStatus: "none" },
    { inviteStatus: "created" },
    { inviteStatus: "opened" },
    { inviteStatus: "in_progress" },
    { inviteStatus: "submitted" },
    { inviteStatus: "expired", inviteOpenedAt: "2026-08-01T00:00:00Z" },
  ]);
  assert.deepEqual(funnel, {
    candidates: 6,
    assigned: 5,
    opened: 4,
    started: 2,
    submitted: 1,
    expired: 1,
    openRate: 80,
    startRate: 50,
    completionRate: 20,
  });
  assert.equal(summarizeInviteFunnel([]).completionRate, null);
});
