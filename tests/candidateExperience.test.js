import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portal = readFileSync(new URL("../src/CandidatePortal.jsx", import.meta.url), "utf8");
const hiring = readFileSync(new URL("../src/HiringPlatform.jsx", import.meta.url), "utf8");
const repository = readFileSync(new URL("../src/hiring/secureRepository.js", import.meta.url), "utf8");

test("candidate sees the fair brief but never the interviewer-only legend", () => {
  assert.match(portal, /workSample\.candidateBrief/);
  assert.doesNotMatch(portal, /workSample\.interviewerBrief/);
  assert.match(hiring, /Легенда только для интервьюера/);
  assert.match(hiring, /Не оцениваем/);
});

test("work-preference pairs advance after a choice without an extra next click", () => {
  assert.match(portal, /choosePreference\(preferenceIndex, "A"\)/);
  assert.match(portal, /choosePreference\(preferenceIndex, "B"\)/);
  assert.doesNotMatch(portal, />Следующая пара</);
});

test("creating a real assessment also attempts an invite and exposes explicit send actions", () => {
  assert.match(repository, /freshInviteUrl = await createCandidateInvite\(created\.assessment_id\)/);
  assert.match(hiring, /Открыть готовое письмо/);
  assert.match(hiring, /письмо не отправляется автоматически/i);
});
