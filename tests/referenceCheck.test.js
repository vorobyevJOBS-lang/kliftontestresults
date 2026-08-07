import test from "node:test";
import assert from "node:assert/strict";
import { emptyReferenceCheck, parseReferenceCheck, referenceDispositionComplete, serializeReferenceCheck } from "../src/hiring/referenceCheck.js";

test("structured reference check requires facts, not a positive vote", () => {
  const value = { ...emptyReferenceCheck(), disposition: "completed", consentConfirmed: true, recommenderNameRole: "Иван, руководитель", relationshipDates: "2023–2025", answers: "Подтвердил роль, задачи и измеримый рабочий результат." };
  const raw = serializeReferenceCheck(value);
  assert.equal(referenceDispositionComplete(raw), true);
  assert.equal(parseReferenceCheck(raw).answers, value.answers);
});

test("an unavailable reference is documented without treating silence as negative", () => {
  const raw = serializeReferenceCheck({ ...emptyReferenceCheck(), disposition: "unavailable", unavailableReason: "Рекомендатель не ответил после двух попыток" });
  assert.equal(referenceDispositionComplete(raw), true);
  assert.equal(referenceDispositionComplete("старые свободные заметки"), false);
});
