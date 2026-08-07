import { decisionReadiness } from "./assessmentEngine.js";
import { referenceDispositionComplete } from "./referenceCheck.js";

const STAGES = new Set(["new", "assignment", "interview", "decision", "offer", "hired", "reserve", "declined"]);

export function pipelineMoveBlock(candidate, profile, targetStage) {
  if (!STAGES.has(targetStage)) return "Неизвестный этап воронки.";
  if (["new", "assignment", "interview"].includes(targetStage)) return "";

  const readiness = decisionReadiness(profile, candidate, 2);
  if (!readiness.ready) return "Сначала нужны две полноценные независимые оценки.";
  if (targetStage === "decision") return "";

  const requiredDecision = { offer: "offer", hired: "offer", reserve: "reserve", declined: "decline" }[targetStage];
  if (candidate.finalDecision !== requiredDecision) return "Сначала зафиксируйте соответствующее решение комиссии в карточке.";
  if (["offer", "hired"].includes(targetStage) && !referenceDispositionComplete(candidate.referenceNotes || "")) {
    return "Перед оффером зафиксируйте статус проверки рекомендаций.";
  }
  return "";
}
