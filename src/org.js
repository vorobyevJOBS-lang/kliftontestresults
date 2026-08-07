export const BRANCHES = [
  { id: "klyachka_nvkz", school: "klyachka", name: "Клячка — Новокузнецк" },
  { id: "klyachka_krsk_center", school: "klyachka", name: "Клячка — Красноярск, Центр" },
  { id: "klyachka_krsk_vzlet", school: "klyachka", name: "Клячка — Красноярск, Взлётка" },
  { id: "jobs_design", school: "jobs", name: "Школа дизайна JOBS" },
];

export const LEGACY_BRANCH_ALIASES = {
  jobs_main: "jobs_design",
  jobs_design: "jobs_design",
};

export const APPLICANT_TYPES = [
  ["candidate", "Кандидат на собеседование"],
  ["employee", "Действующий сотрудник"],
];

export function branchById(id) {
  const canonicalId = LEGACY_BRANCH_ALIASES[id] || id;
  return BRANCHES.find((b) => b.id === canonicalId) || BRANCHES[0];
}
