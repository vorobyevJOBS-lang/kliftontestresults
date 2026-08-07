import test from "node:test";
import assert from "node:assert/strict";
import { parseCandidateResponse } from "../src/hiring/candidateResponse.js";

test("candidate response keeps structured screening and work sample", () => {
  const payload = JSON.stringify({
    schema: "evidencehire-candidate-v1",
    screening: { availability: "Могу работать по будням" },
    workSample: "[ПЛАН ИЛИ РЕШЕНИЕ]\nСначала уточню цель",
    rolePreferences: {
      schema: "work-preferences-fc-legacy-166-v1",
      itemBankSha256: "33c2f9e6f716b90029912db46899b6c02de82ea43f5d9a5ced9119986ec6ea1b",
      answers: ["A", "B", "X"],
    },
  });
  assert.deepEqual(parseCandidateResponse(payload), {
    screening: { availability: "Могу работать по будням" },
    workSample: "[ПЛАН ИЛИ РЕШЕНИЕ]\nСначала уточню цель",
    workPreferenceAnswers: ["A", "B"],
  });
});

test("historical plain-text invite response remains readable", () => {
  assert.deepEqual(parseCandidateResponse("Старый текст ответа"), {
    screening: {},
    workSample: "Старый текст ответа",
    workPreferenceAnswers: [],
  });
});
