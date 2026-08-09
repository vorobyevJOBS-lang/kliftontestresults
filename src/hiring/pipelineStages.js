export const PRIMARY_PIPELINE_STAGES = [
  { id: "new", label: "Новый", values: ["new", "contact", "screening"] },
  { id: "assignment", label: "Тест", values: ["assignment", "testing"] },
  { id: "interview", label: "Предобучение", values: ["interview"] },
  { id: "work_sample", label: "Стажировка", values: ["work_sample", "decision", "references"] },
  { id: "offer", label: "Оффер", values: ["offer"] },
];

export const CLOSED_PIPELINE_STAGES = [
  { id: "hired", label: "Нанят", values: ["hired"] },
  { id: "reserve", label: "Резерв", values: ["reserve"] },
  { id: "declined", label: "Отказ", values: ["declined"] },
];

export const PIPELINE_BOARD_STAGES = [...PRIMARY_PIPELINE_STAGES, ...CLOSED_PIPELINE_STAGES];

export const LEGACY_PIPELINE_OPTIONS = [
  ["contact", "Новый · прежний этап «Контакт»"],
  ["screening", "Новый · прежний этап «Скрининг»"],
  ["testing", "Тест · прежний этап «Тестирование»"],
  ["decision", "Стажировка · прежний этап «Решение»"],
  ["references", "Стажировка · прежний этап «Рекомендации»"],
];

export const PIPELINE_STAGE_OPTIONS = [
  ...PRIMARY_PIPELINE_STAGES.map(({ id, label }) => [id, label]),
  ...CLOSED_PIPELINE_STAGES.map(({ id, label }) => [id, label]),
];

export function pipelineColumnFor(stageId) {
  return PIPELINE_BOARD_STAGES.find((stage) => stage.values.includes(stageId || "new")) || PRIMARY_PIPELINE_STAGES[0];
}

export function pipelineStageLabel(stageId) {
  return pipelineColumnFor(stageId).label;
}

export function stageMatchesColumn(stageId, column) {
  return column.values.includes(stageId || "new");
}

export function activePipelineStage(stageId) {
  return PRIMARY_PIPELINE_STAGES.some((stage) => stage.values.includes(stageId || "new"));
}
