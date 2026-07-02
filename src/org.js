export const BRANCHES = [
  { id: "klyachka_nvkz", school: "klyachka", name: "Клячка — Новокузнецк" },
  { id: "klyachka_krsk_center", school: "klyachka", name: "Клячка — Красноярск Центр" },
  { id: "klyachka_krsk_vzlet", school: "klyachka", name: "Клячка — Красноярск Взлётка" },
  { id: "jobs_main", school: "jobs", name: "Jobs" },
];

export const APPLICANT_TYPES = [
  ["candidate", "Кандидат на собеседование"],
  ["employee", "Действующий сотрудник"],
];

export function branchById(id) {
  return BRANCHES.find((b) => b.id === id) || BRANCHES[0];
}
