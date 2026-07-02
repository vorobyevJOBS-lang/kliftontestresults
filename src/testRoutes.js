export const TEST_ROUTE_META = {
  clifton: { label: "Клифтон", icon: "🏆" },
  rezultat: { label: "Опыт", icon: "📊" },
  tools: { label: "Профиль", icon: "🎯" },
  logis: { label: "Логика", icon: "🧠" },
  sails: { label: "Продажник", icon: "💎" },
  prim: { label: "Анализ", icon: "🧭" },
};

const SALES_ROLES = new Set(["sales_manager", "lead_manager", "promoter", "sales_head", "callcenter_head"]);
const LEADER_ROLES = new Set(["supervisor", "callcenter_head", "product_manager", "sales_head", "director"]);
const CARE_ROLES = new Set(["teacher", "tutor"]);

export function getTestRouteForRole(roleId) {
  if (SALES_ROLES.has(roleId)) {
    return {
      required: ["clifton", "sails", "tools", "prim"],
      optional: ["rezultat", "logis"],
      reason: "Для продаж важны мотивация, устойчивость, клиентский стиль, личностные риски и способность доводить сделки.",
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
      required: ["clifton", "tools", "prim"],
      optional: ["rezultat", "logis"],
      reason: "Для обучающих и сопровождающих ролей важны сильные стороны, коммуникация, устойчивость и способность работать с людьми.",
    };
  }

  return {
    required: ["clifton", "tools", "prim", "logis"],
    optional: ["rezultat"],
    reason: "Для операционных ролей важны сильные стороны, рабочий стиль, внимательность, логика и личностная устойчивость.",
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
