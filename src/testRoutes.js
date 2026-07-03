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
      required: ["sails", "tools"],
      optional: ["clifton", "prim"],
      reason: "Для менеджера записи достаточно быстро проверить клиентский стиль, дисциплину и способность доводить контакт до записи.",
    };
  }

  if (roleId === "sales_manager") {
    return {
      required: ["clifton", "sails", "prim"],
      optional: ["tools", "rezultat"],
      reason: "Для менеджера продаж важны сильные стороны, продажный стиль и личностные риски; дополнительные тесты нужны для спорных кандидатов.",
    };
  }

  if (LEADER_ROLES.has(roleId)) {
    return {
      required: ["clifton", "tools", "prim", "logis"],
      optional: ["rezultat", "sails"],
      reason: "Для руководителей важны сильные стороны, управленческий стиль, аналитика, личностные риски и опыт результата.",
    };
  }

  if (CARE_ROLES.has(roleId)) {
    return {
      required: ["clifton", "prim"],
      optional: ["tools", "rezultat"],
      reason: "Для обучающих и сопровождающих ролей сначала проверяем сильные стороны, устойчивость и работу с людьми; остальные тесты добавляем при сомнениях.",
    };
  }

  if (roleId === "administrator") {
    return {
      required: ["tools", "logis"],
      optional: ["prim", "clifton"],
      reason: "Для администратора в первую очередь важны рабочий стиль, внимательность, логика и дисциплина; глубокий профиль нужен для финальных кандидатов.",
    };
  }

  return {
    required: ["clifton", "prim"],
    optional: ["tools", "logis", "rezultat"],
    reason: "Базовый маршрут не перегружает кандидата: сначала проверяем сильные стороны и риски, дополнительные тесты добавляем по необходимости.",
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
