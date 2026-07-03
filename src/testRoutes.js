export const TEST_ROUTE_META = {
  clifton: { label: "Клифтон", icon: "🏆", minutes: 50 },
  rezultat: { label: "Опыт", icon: "📊", minutes: 12 },
  tools: { label: "Профиль", icon: "🎯", minutes: 35 },
  logis: { label: "Логика", icon: "🧠", minutes: 30 },
  sails: { label: "Продажник", icon: "💎", minutes: 30 },
  prim: { label: "Анализ", icon: "🧭", minutes: 36 },
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
  const summary = getRouteSummary(route);
  return {
    ...route,
    ...summary,
    requiredDone,
    optionalDone,
    missingRequired: route.required.filter((testId) => !entriesByType[testId]),
    missingOptional: route.optional.filter((testId) => !entriesByType[testId]),
  };
}

export function getRouteSummary(route) {
  const requiredMinutes = route.required.reduce((sum, testId) => sum + (TEST_ROUTE_META[testId]?.minutes || 0), 0);
  const optionalMinutes = route.optional.reduce((sum, testId) => sum + (TEST_ROUTE_META[testId]?.minutes || 0), 0);
  const requiredCount = route.required.length;
  const level = requiredCount <= 1 ? "Лёгкий маршрут" : requiredCount <= 3 ? "Базовый маршрут" : "Полный маршрут";
  const color = requiredCount <= 1 ? "#2E9E87" : requiredCount <= 3 ? "#D98E2B" : "#6457D6";
  return {
    requiredMinutes,
    optionalMinutes,
    requiredCount,
    optionalCount: route.optional.length,
    level,
    color,
  };
}
