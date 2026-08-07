import { TALENT_META } from "../talentMeta.js";
import { buildWorkPreferenceMap } from "./workPreferenceMap.js";

const ROLE_HYPOTHESES = [
  {
    profileId: "klyachka_enrollment_manager",
    school: "klyachka",
    name: "Менеджер записи — Клячка",
    weights: { COMMUNICATION: 10, CUSTOMER_FOCUS: 10, PERSISTENCE: 9, INFLUENCE: 8, RESPONSIBILITY: 8 },
    verification: "Ролевой звонок по входящей заявке: выяснить цель, записать и повысить вероятность фактического прихода.",
  },
  {
    profileId: "jobs_enrollment_manager",
    school: "jobs",
    name: "Менеджер записи — JOBS",
    weights: { COMMUNICATION: 10, CUSTOMER_FOCUS: 10, PERSISTENCE: 9, INFLUENCE: 8, RESPONSIBILITY: 8 },
    verification: "Ролевой звонок по входящей заявке: выяснить цель, записать и повысить вероятность фактического прихода.",
  },
  {
    profileId: "klyachka_trial_sales_manager",
    school: "klyachka",
    name: "Менеджер пробного урока и продаж — Клячка",
    weights: { COMMUNICATION: 10, INFLUENCE: 10, ACHIEVEMENT: 10, NEGOTIATION: 9, CUSTOMER_FOCUS: 8 },
    verification: "Фрагмент пробного урока и этичный разговор о решении: без давления и знания внутренних скриптов.",
  },
  {
    profileId: "jobs_trial_sales_manager",
    school: "jobs",
    name: "Менеджер пробного урока и продаж — JOBS",
    weights: { COMMUNICATION: 10, INFLUENCE: 10, ACHIEVEMENT: 10, NEGOTIATION: 9, CUSTOMER_FOCUS: 8 },
    verification: "Фрагмент пробного урока и этичный разговор о решении: без давления и знания внутренних скриптов.",
  },
  {
    profileId: "school_administrator",
    school: "klyachka",
    name: "Администратор школы — Клячка",
    weights: { RESPONSIBILITY: 10, ORGANIZATION: 10, DISCIPLINE: 10, CUSTOMER_FOCUS: 8, COMMUNICATION: 7 },
    verification: "Разобрать одновременный сбой в расписании, оформлении ученика и заказе материалов: задать приоритеты и точки контроля.",
  },
  {
    profileId: "jobs_records_administrator",
    school: "jobs",
    name: "Администратор-делопроизводитель — JOBS",
    weights: { RESPONSIBILITY: 10, ORGANIZATION: 10, DISCIPLINE: 10, ANALYTICAL: 8, CUSTOMER_FOCUS: 7 },
    verification: "Разобрать кейс с документами, оплатой и срочным заказом: найти риски ошибки и описать проверку.",
  },
  {
    profileId: "jobs_tutor",
    school: "jobs",
    name: "Тьютор — JOBS",
    weights: { DEVELOPER: 10, EMPATHY: 10, CUSTOMER_FOCUS: 9, RESPONSIBILITY: 8, RELATIONSHIP: 8 },
    verification: "Ролевая беседа со студентом на грани возврата: уточнить причину, не дать ложных обещаний и зафиксировать следующий шаг.",
  },
  {
    profileId: "klyachka_art_teacher",
    school: "klyachka",
    name: "Преподаватель рисования — Клячка",
    weights: { EMPATHY: 10, DEVELOPER: 10, LEARNER: 9, COMMUNICATION: 8, RESPONSIBILITY: 8 },
    verification: "Мини-урок для начинающего: поставить понятную цель, проверить понимание и адаптировать помощь при затруднении.",
  },
  {
    profileId: "jobs_design_mentor",
    school: "jobs",
    name: "Преподаватель дизайна — JOBS",
    weights: { DEVELOPER: 10, LEARNER: 10, ANALYTICAL: 9, COMMUNICATION: 8, RESPONSIBILITY: 8 },
    verification: "Разбор учебной работы: отделить факты от вкуса, задать вопросы и дать посильный следующий шаг без переделки за студента.",
  },
  {
    profileId: "sales_team_lead",
    school: "all",
    name: "РОП или руководитель колл-центра",
    weights: { LEADERSHIP: 10, INFLUENCE: 10, ACHIEVEMENT: 9, ANALYTICAL: 8, STRATEGIC: 8 },
    verification: "Разобрать воронку и два фрагмента звонков: отделить качество данных от проблемы навыка и задать план проверки.",
  },
  {
    profileId: "branch_manager",
    school: "all",
    name: "Управляющий филиалом",
    weights: { LEADERSHIP: 10, STRATEGIC: 10, RESPONSIBILITY: 9, ANALYTICAL: 9, ACHIEVEMENT: 8 },
    verification: "План первых 30 дней по трём проблемам филиала: выбрать приоритет, разделить диагностику и действия, назначить точки контроля.",
  },
];

function schoolForProfile(profileId) {
  return ROLE_HYPOTHESES.find((role) => role.profileId === profileId)?.school || "all";
}

export function buildRoleRelevance(answers, currentProfileId) {
  const preferenceMap = buildWorkPreferenceMap(answers);
  if (!preferenceMap) return null;

  const themeById = Object.fromEntries(preferenceMap.rankedThemes.map((theme) => [theme.id, theme]));
  const currentSchool = schoolForProfile(currentProfileId);
  const eligibleRoles = ROLE_HYPOTHESES.filter((role) => currentSchool === "all" || role.school === "all" || role.school === currentSchool);
  const rankedRoles = eligibleRoles
    .map((role) => {
      const entries = Object.entries(role.weights);
      const comparisonIndex = entries.reduce((total, [themeId, weight]) => total + (themeById[themeId]?.relativeSelection || 0) * weight, 0)
        / entries.reduce((total, [, weight]) => total + weight, 0);
      const matchedThemes = entries
        .map(([themeId, weight]) => ({ ...themeById[themeId], weight }))
        .sort((first, second) => (second.relativeSelection * second.weight) - (first.relativeSelection * first.weight))
        .slice(0, 3)
        .map(({ id, name }) => ({ id, name }));
      const strongestTheme = matchedThemes[0];
      return {
        profileId: role.profileId,
        name: role.name,
        current: role.profileId === currentProfileId,
        comparisonIndex,
        matchedThemes,
        interviewQuestion: TALENT_META[strongestTheme?.id]?.iq || "Приведите недавний рабочий пример, который подтверждает эту гипотезу.",
        verification: role.verification,
      };
    })
    .sort((first, second) => second.comparisonIndex - first.comparisonIndex || first.name.localeCompare(second.name, "ru"))
    .map((role, index) => ({
      ...role,
      rank: index + 1,
      signal: index === 0 ? "Наиболее близкая карта" : index < 3 ? "Близкая гипотеза" : "Нужна отдельная проверка",
    }));

  const visibleRoles = rankedRoles.slice(0, 3);
  const currentRole = rankedRoles.find((role) => role.current);
  if (currentRole && !visibleRoles.some((role) => role.profileId === currentRole.profileId)) visibleRoles.push(currentRole);

  return {
    roles: visibleRoles.map(({ comparisonIndex: _comparisonIndex, ...role }) => role),
    comparedRoleCount: rankedRoles.length,
    note: "Это ранжирование ролей по выбранным рабочим предпочтениям, а не прогноз успеха. Любую гипотезу нужно проверить одинаковой рабочей пробой и структурированным интервью.",
  };
}
