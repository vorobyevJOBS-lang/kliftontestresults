export const TEST_ROUTE_META = {
  clifton: { label: "Клифтон", icon: "🏆" },
  rezultat: { label: "Опыт", icon: "📊" },
  tools: { label: "Профиль", icon: "🎯" },
  logis: { label: "Логика", icon: "🧠" },
  sails: { label: "Продажник", icon: "💎" },
  prim: { label: "Анализ", icon: "🧭" },
};

const LEADER_ROLES = new Set(["supervisor", "callcenter_head", "product_manager", "sales_head", "director"]);
const CARE_ROLES = new Set(["teacher", "tutor"]);

export function getTestRouteForRole(roleId) {
  if (roleId === "promoter") {
    return {
      required: ["sails"],
      optional: ["clifton", "prim"],
      reason: "Для промоутера важен быстрый вход: сначала коротко проверяем продажи и контактность, а глубокие тесты добавляем только если кандидат перспективный.",
    };
  }

  if (roleId === "lead_manager") {
    return {
      required: ["rezultat", "sails", "tools"],
      optional: ["clifton", "prim"],
      reason: "Для менеджера записи важно быстро увидеть опыт, клиентский стиль, дисциплину и способность доводить контакт до записи.",
    };
  }

  if (roleId === "sales_manager") {
    return {
      required: ["rezultat", "clifton", "sails", "prim"],
      optional: ["tools"],
      reason: "Для менеджера продаж важны прошлый опыт, сильные стороны, продажный стиль и личностные риски; профиль добавляем для спорных кандидатов.",
    };
  }

  if (LEADER_ROLES.has(roleId)) {
    return {
      required: ["rezultat", "clifton", "tools", "prim", "logis"],
      optional: ["sails"],
      reason: "Для руководителей важны прошлый опыт, сильные стороны, управленческий стиль, аналитика, личностные риски и опыт результата.",
    };
  }

  if (CARE_ROLES.has(roleId)) {
    return {
      required: ["rezultat", "clifton", "prim"],
      optional: ["tools"],
      reason: "Для обучающих и сопровождающих ролей важно видеть прошлый опыт, сильные стороны, устойчивость и работу с людьми; профиль добавляем при сомнениях.",
    };
  }

  if (roleId === "administrator") {
    return {
      required: ["rezultat", "tools", "logis"],
      optional: ["prim", "clifton"],
      reason: "Для администратора важны прошлый опыт, рабочий стиль, внимательность, логика и дисциплина; глубокий профиль нужен для финальных кандидатов.",
    };
  }

  return {
    required: ["rezultat", "clifton", "prim"],
    optional: ["tools", "logis"],
    reason: "Базовый маршрут не перегружает кандидата: сначала смотрим опыт, сильные стороны и риски, дополнительные тесты добавляем по необходимости.",
  };
}

export function getRouteProgress(entriesByType, roleId) {
  const route = getTestRouteForRole(roleId);
  const requiredDone = route.required.filter((testId) => entriesByType[testId]);
  const optionalDone = route.optional.filter((testId) => entriesByType[testId]);
  return {
    ...route,
    requiredDone,
    optionalDone,
    missingRequired: route.required.filter((testId) => !entriesByType[testId]),
    missingOptional: route.optional.filter((testId) => !entriesByType[testId]),
  };
}
