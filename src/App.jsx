import { useEffect, useState } from "react";
import { QUESTIONS } from "./questions";
import { TALENTS } from "./talents";
import { ROLE_PROFILES } from "./roles";
import { TALENT_META, TALENT_GROWTH } from "./talentMeta";
import { ROLE_QUESTIONS } from "./roleQuestions";
import { supabase } from "./supabase";
import RezultTest from "./RezultTest";
import ToolsTest from "./ToolsTest";
import LogisTest from "./LogisTest";
import SailsTest from "./SailsTest";
import PrimTest from "./PrimTest";
import AudienceFields from "./AudienceFields";
import { BRANCHES, branchById } from "./org";
import TestStartLayout, { StartButton, startInputStyle, startLabelStyle } from "./TestStartLayout";

// ─────────────────────────────────────────────────────────────
// ДОМЕНЫ — визуальная группировка талантов
// ─────────────────────────────────────────────────────────────
const DOMAINS = {
  "Исполнение": { color: "#D98E2B", soft: "#FBF1E2" },
  "Влияние": { color: "#E25C44", soft: "#FCEAE6" },
  "Отношения": { color: "#2E9E87", soft: "#E4F4F0" },
  "Мышление": { color: "#6457D6", soft: "#ECEAFB" },
};

// Максимально возможный счёт по каждому таланту (сколько раз он встречается в вопросах)
const MAX_BY_TALENT = (() => {
  const max = {};
  Object.keys(TALENTS).forEach((k) => { max[k] = 0; });
  QUESTIONS.forEach((q) => { max[q.talentA] += 1; max[q.talentB] += 1; });
  return max;
})();

const ALL_POSITIONS = Object.entries(ROLE_PROFILES).map(([id, r]) => ({ id, name: r.name }));

const TEST_CARDS = [
  { id: "clifton", icon: "🏆", title: "Клифтон", desc: "Сильные стороны", meta: `${QUESTIONS.length} пар · 45-50 мин`, accent: "#D98E2B", muted: "#FBF1E2" },
  { id: "rezultat", icon: "📊", title: "Опыт", desc: "Продуктивность и трудовой путь", meta: "19 вопросов · 8-12 мин", accent: "#2563EB", muted: "#EEF3FF" },
  { id: "tools", icon: "🎯", title: "Профиль", desc: "Характер и рабочий стиль", meta: "200 вопросов · 35 мин", accent: "#0F766E", muted: "#E4F4F0" },
  { id: "logis", icon: "🧠", title: "Логика", desc: "Логическое мышление", meta: "80 вопросов · 30 мин", accent: "#6C63FF", muted: "#EEF2FF" },
  { id: "sails", icon: "💎", title: "Продажник", desc: "Потенциал в продажах", meta: "120 вопросов · 30 мин", accent: "#9C27B0", muted: "#F3E5F5" },
  { id: "prim", icon: "🧭", title: "Первичный анализ", desc: "Личностный профиль", meta: "160 вопросов · 30-36 мин", accent: "#7C3AED", muted: "#F1EAFF" },
];

function positionsForSchool(school) {
  if (school === "klyachka") return ALL_POSITIONS.filter((p) => p.id !== "tutor");
  return ALL_POSITIONS;
}

// ─────────────────────────────────────────────────────────────
// СТИЛИ
// ─────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: "100vh", background: "#F6F5F2", color: "#1C1B1A", fontFamily: "'Golos Text', system-ui, sans-serif" },
  wrap: { maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px" },
  display: { fontFamily: "'Unbounded', 'Golos Text', sans-serif" },
  card: { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(28,27,26,.07)", marginBottom: 16 },
  btn: { display: "inline-block", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  ghost: { background: "transparent", border: "1.5px solid #D8D5CF", color: "#1C1B1A" },
  primary: { background: "#1C1B1A", color: "#fff" },
};

function Bar({ pct, color }) {
  return (
    <div style={{ height: 8, background: "#EEECE7", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(pct, 2)}%`, height: "100%", background: color, borderRadius: 99, transition: "width .6s ease" }} />
    </div>
  );
}

function DomainTag({ domain }) {
  const dm = DOMAINS[domain] || DOMAINS["Исполнение"];
  return (
    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: dm.color, background: dm.soft, padding: "3px 10px", borderRadius: 99 }}>
      {domain}
    </span>
  );
}

function HomeTestCard({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = item.accent;
        e.currentTarget.style.background = item.muted;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 10px 24px ${item.accent}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = active ? item.accent : "#EEECE7";
        e.currentTarget.style.background = active ? item.muted : "#fff";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = active ? `0 8px 20px ${item.accent}1F` : "0 1px 3px rgba(28,27,26,.07)";
      }}
      style={{
        border: active ? `1.5px solid ${item.accent}` : "1.5px solid #EEECE7",
        background: active ? item.muted : "#fff",
        color: "#1C1B1A",
        borderRadius: 14,
        padding: 18,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        minHeight: 156,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: active ? `0 8px 20px ${item.accent}1F` : "0 1px 3px rgba(28,27,26,.07)",
        transition: "background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease",
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 22 }}>{item.icon}</div>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: active ? "#B6F2C8" : item.accent,
            background: active ? "rgba(76,208,128,.15)" : item.muted,
            padding: "4px 9px",
            borderRadius: 99,
            whiteSpace: "nowrap",
          }}>
            {active ? "Сейчас выбран" : "Открыть"}
          </span>
        </div>
        <div style={{ ...S.display, fontWeight: 700, fontSize: 17, lineHeight: 1.25, marginBottom: 6 }}>{item.title}</div>
        <div style={{ fontSize: 13, color: "#44413B", lineHeight: 1.45 }}>{item.desc}</div>
      </div>
      <div style={{ fontSize: 12, color: "#8A867E", lineHeight: 1.35, marginTop: 14 }}>{item.meta}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// РАСЧЁТ РЕЗУЛЬТАТА
// ─────────────────────────────────────────────────────────────
function computeResult(answers, positionId, schoolPositionIds) {
  // ── 0. Пропущенные вопросы (таймер истёк) ──────────────────
  const nullAnswers = answers.filter((a) => a === null).length;

  // ── 1. Основной профиль только по НЕ-validation вопросам ───
  // Нужен для consistency check, чтобы сравнить с validation-вопросами
  const mainRaw = {}, mainMax = {};
  Object.keys(TALENTS).forEach((k) => { mainRaw[k] = 0; mainMax[k] = 0; });
  QUESTIONS.forEach((q) => {
    if (!q.validation) { mainMax[q.talentA]++; mainMax[q.talentB]++; }
  });
  answers.forEach((side, i) => {
    const q = QUESTIONS[i];
    if (!q || q.validation) return;
    if (side === "A") mainRaw[q.talentA]++;
    if (side === "B") mainRaw[q.talentB]++;
  });
  const mainPct = {};
  Object.keys(TALENTS).forEach((k) => {
    mainPct[k] = Math.round((mainRaw[k] / (mainMax[k] || 1)) * 100);
  });

  // ── 2. Consistency check на validation-вопросах ─────────────
  // Сравниваем ответ на каждый validation-вопрос с тем,
  // что ожидается исходя из основного профиля.
  // Если разница в основном профиле ≤ 5% — пара считается нейтральной (не вносит ошибки).
  const validationQs = QUESTIONS.filter((q) => q.validation);
  let consistentCount = 0, validationAnswered = 0;
  validationQs.forEach((q) => {
    const idx = QUESTIONS.indexOf(q);
    const side = answers[idx];
    if (side === null || side === undefined) return;
    validationAnswered++;
    const pA = mainPct[q.talentA] ?? 50;
    const pB = mainPct[q.talentB] ?? 50;
    if (Math.abs(pA - pB) <= 5) {
      consistentCount++; // нейтральная пара — не штрафуем
    } else {
      const expected = pA >= pB ? "A" : "B";
      if (side === expected) consistentCount++;
    }
  });
  const consistencyScore = validationAnswered > 0
    ? Math.round((consistentCount / validationAnswered) * 100)
    : null;
  const consistencyColor =
    consistencyScore === null ? "#8A867E" :
    consistencyScore >= 70   ? "#2E9E87" :
    consistencyScore >= 50   ? "#D98E2B" : "#E25C44";
  const consistencyLabel =
    consistencyScore === null ? "Нет данных" :
    consistencyScore >= 70   ? "Ответы согласованные" :
    consistencyScore >= 50   ? "Есть противоречия — уточните на собеседовании" :
                               "Много противоречий — результат под вопросом";

  // ── 3. Полный профиль (все вопросы включая validation) ──────
  const scores = {};
  Object.keys(TALENTS).forEach((k) => { scores[k] = 0; });
  answers.forEach((side, i) => {
    const q = QUESTIONS[i];
    if (!q) return;
    if (side === "A") scores[q.talentA] += 1;
    if (side === "B") scores[q.talentB] += 1;
  });

  // нормализуем по максимально возможному счёту для каждого таланта — это даёт сравнимые % между талантами
  const talentScores = Object.keys(TALENTS).map((id) => {
    const max = MAX_BY_TALENT[id] || 1;
    const pct = Math.round((scores[id] / max) * 100);
    return { id, score: scores[id], max, pct };
  }).sort((a, b) => b.pct - a.pct);
  talentScores.forEach((t, i) => { t.rank = i + 1; });

  // z-оценки: насколько % этого таланта отклоняется от среднего по ВСЕМ талантам этого человека
  // (ипсативный взгляд — что выделяется именно у этого человека, а не абсолютная шкала)
  const meanPct = talentScores.reduce((a, t) => a + t.pct, 0) / talentScores.length;
  const variance = talentScores.reduce((a, t) => a + (t.pct - meanPct) ** 2, 0) / talentScores.length;
  const stdDev = Math.sqrt(variance) || 1;
  talentScores.forEach((t) => { t.z = (t.pct - meanPct) / stdDev; });

  const top5 = talentScores.slice(0, 5);
  const bottom3 = talentScores.slice(-3);

  // профиль доменов — средний % по входящим в домен талантам
  const domainScores = Object.keys(DOMAINS).map((d) => {
    const ts = talentScores.filter((t) => TALENTS[t.id].domain === d);
    const avg = Math.round(ts.reduce((a, t) => a + t.pct, 0) / ts.length);
    return { id: d, pct: avg };
  }).sort((a, b) => b.pct - a.pct);

  // соответствие должностям — на z-оценках: важно не "сколько процентов набрал",
  // а выделяется ли этот талант на фоне остального профиля человека
  const allZ = talentScores.map((t) => t.z);
  const minZ = Math.min(...allZ), maxZ = Math.max(...allZ);
  const allowedIds = schoolPositionIds || Object.keys(ROLE_PROFILES);
  let roleMatches = Object.entries(ROLE_PROFILES)
    .filter(([roleId]) => allowedIds.includes(roleId))
    .map(([roleId, r]) => {
      let weighted = 0, totalWeight = 0;
      const roleKeyTs = [];
      Object.entries(r.weights).forEach(([talentId, weight]) => {
        const t = talentScores.find((x) => x.id === talentId);
        weighted += (t ? t.z : 0) * weight;
        totalWeight += weight;
        if (t) roleKeyTs.push(t);
      });
      const avgZ = weighted / totalWeight;
      // Относительная оценка (z-score растянут до 0-100%)
      const span = (maxZ - minZ) || 1;
      const relativeFit = Math.round(((avgZ - minZ) / span) * 100);
      // Абсолютная оценка: какая доля ключевых талантов в топ-половине профиля (rank ≤ 10 из 20)
      const halfRank = Math.ceil(talentScores.length / 2);
      const absoluteFit = roleKeyTs.length > 0
        ? Math.round((roleKeyTs.filter((t) => t.rank <= halfRank).length / roleKeyTs.length) * 100)
        : 50;
      // Итог: 40% относительный + 60% абсолютный
      // Это не даёт слабому кандидату 100% по "лучшей из плохих" роли
      const fit = Math.round(
        0.4 * Math.max(0, Math.min(100, relativeFit)) + 0.6 * absoluteFit
      );
      return { roleId, roleName: r.name, fit: Math.max(0, Math.min(100, fit)) };
    }).sort((a, b) => b.fit - a.fit);

  // Для кандидата без выбранной должности — берём лучшее совпадение как "рекомендуемую" роль.
  // Для сотрудника — используем выбранную должность.
  const effectivePositionId = positionId || roleMatches[0].roleId;
  const role = ROLE_PROFILES[effectivePositionId];
  const thisRoleFit = roleMatches.find((r) => r.roleId === effectivePositionId) || roleMatches[0];
  const isRecommended = !positionId; // true для кандидата — должность определена автоматически

  // ключевые таланты для оцениваемой должности, отсортированные по весу
  const keyTalentIds = Object.entries(role.weights).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const keyTalents = keyTalentIds.map((id) => talentScores.find((t) => t.id === id));
  const avgKeyRank = keyTalents.reduce((a, t) => a + t.rank, 0) / keyTalents.length;
  const weakKeys = keyTalents.filter((t) => t.rank > 12).sort((a, b) => b.rank - a.rank);

  let fit, fitNote;
  if (isRecommended) {
    fit = "Рекомендуемая должность определена автоматически";
    fitNote = `По результатам теста наиболее подходящая роль для кандидата — «${role.name}» (${thisRoleFit.fit}%). Ниже приведён полный рейтинг соответствия всем должностям — он показывает, где у кандидата больше шансов быть результативным.`;
  } else if (avgKeyRank <= 7 && weakKeys.length === 0) {
    fit = "Высокое соответствие должности";
    fitNote = `Ключевые для роли «${role.name}» качества в среднем занимают ${avgKeyRank.toFixed(1)}-е место в профиле (из 20) — входят в число наиболее выраженных сторон.`;
  } else if (avgKeyRank <= 12 && weakKeys.length <= 1) {
    fit = "Среднее соответствие должности";
    fitNote = `Ключевые для роли «${role.name}» качества в среднем занимают ${avgKeyRank.toFixed(1)}-е место в профиле (из 20). Часть выражена сильно, часть — нет. Решение лучше принимать по итогам собеседования.`;
  } else {
    fit = "Низкое соответствие должности";
    fitNote = `Ключевые для роли «${role.name}» качества в среднем занимают ${avgKeyRank.toFixed(1)}-е место в профиле (из 20) — относятся к менее выраженным сторонам. Рекомендуем посмотреть рейтинг соответствия другим должностям ниже.`;
  }

  // сводка для руководителя
  const summarySourceIds = [...new Set([...top5.map((t) => t.id), ...weakKeys.map((t) => t.id)])];
  const pitfalls = summarySourceIds
    .filter((id) => TALENT_META[id]?.pitfall)
    .slice(0, 5)
    .map((id) => ({ id, rank: talentScores.find((t) => t.id === id).rank, text: TALENT_META[id].pitfall }));
  const watchpoints = summarySourceIds
    .filter((id) => TALENT_META[id]?.watch)
    .slice(0, 5)
    .map((id) => ({ id, rank: talentScores.find((t) => t.id === id).rank, text: TALENT_META[id].watch }));

  const top3names = top5.slice(0, 3).map((t) => TALENTS[t.id].name.toLowerCase());
  const portrait = `Доминирующие качества — ${top3names.join(", ")}. ${TALENTS[top5[0].id].description} В сочетании с остальными это формирует основной стиль работы человека: на это стоит опираться при постановке задач.`;

  // точечные вопросы для интервью
  const roleQ = ROLE_QUESTIONS[effectivePositionId] || {};
  const askedIds = new Set();
  const targetedQuestions = [];
  weakKeys.forEach((t) => {
    const q = roleQ[t.id] || TALENT_META[t.id]?.iq;
    if (q && !askedIds.has(t.id)) { targetedQuestions.push({ id: t.id, q, rank: t.rank }); askedIds.add(t.id); }
  });
  bottom3.forEach((t) => {
    const q = roleQ[t.id] || TALENT_META[t.id]?.iq;
    if (q && !askedIds.has(t.id)) { targetedQuestions.push({ id: t.id, q, rank: t.rank }); askedIds.add(t.id); }
  });
  if (targetedQuestions.length < 3) {
    top5.forEach((t) => {
      if (targetedQuestions.length >= 4) return;
      const q = roleQ[t.id] || TALENT_META[t.id]?.iq;
      if (q && !askedIds.has(t.id)) { targetedQuestions.push({ id: t.id, q, rank: t.rank }); askedIds.add(t.id); }
    });
  }

  // план развития — только для действующих сотрудников: ключевые для их роли таланты,
  // которые слабее остальных КЛЮЧЕВЫХ для роли талантов (даже если в общем профиле они не самые худшие —
  // важно, что относительно требований именно этой роли это зона роста)
  const keyAvgRankForDev = keyTalents.reduce((a, t) => a + t.rank, 0) / keyTalents.length;
  const developmentPlan = !isRecommended
    ? keyTalents
        .filter((t) => t.rank > keyAvgRankForDev && TALENT_GROWTH[t.id])
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 4)
        .map((t) => ({ id: t.id, rank: t.rank, pct: t.pct, tip: TALENT_GROWTH[t.id] }))
    : [];

  return {
    talentScores, domainScores, top5, bottom3, roleMatches, thisRoleFit,
    role, isRecommended, avgKeyRank, weakKeys, fit, fitNote, portrait, pitfalls, watchpoints, targetedQuestions, developmentPlan,
    consistencyScore, consistencyLabel, consistencyColor, nullAnswers,
  };
}

function buildPlainText(rec) {
  const r = rec.result;
  const lines = [];
  const branchName = branchById(rec.branchId).name;
  const typeName = rec.applicantType === "employee" ? "Действующий сотрудник" : "Кандидат на собеседование";
  lines.push(`РЕЗУЛЬТАТ ТЕСТА СИЛЬНЫХ СТОРОН (${QUESTIONS.length} пар утверждений)`);
  lines.push(`Имя: ${rec.name}`);
  lines.push(`Филиал: ${branchName} · Тип: ${typeName}`);
  lines.push(`Должность: ${r.role.name} · Дата: ${new Date(rec.date).toLocaleDateString("ru-RU")}`);
  if (rec.candidateEmail) lines.push(`Email: ${rec.candidateEmail}`);
  lines.push(``);
  lines.push(`ВЕРДИКТ: ${r.fit} (${r.thisRoleFit.fit}%)`);
  lines.push(r.fitNote);
  lines.push(``);
  const reliabilityLine = r.consistencyScore != null
    ? `НАДЁЖНОСТЬ ОТВЕТОВ: ${r.consistencyLabel} (${r.consistencyScore}%)`
    : `НАДЁЖНОСТЬ ОТВЕТОВ: нет данных`;
  const skipWarning = (r.nullAnswers ?? 0) > 0
    ? ` · ⚠ ${r.nullAnswers} вопр. пропущено по таймеру`
    : "";
  lines.push(reliabilityLine + skipWarning);
  lines.push(``);
  lines.push(`═══ СВОДКА ДЛЯ РУКОВОДИТЕЛЯ ═══`);
  lines.push(``);
  lines.push(`КТО ЭТО ЧЕЛОВЕК (портрет):`);
  lines.push(r.portrait);
  lines.push(``);
  lines.push(`ПОДВОДНЫЕ КАМНИ — чего вероятно ждать:`);
  r.pitfalls.forEach((p) => lines.push(`— [${TALENTS[p.id].name}, #${p.rank}] ${p.text}`));
  lines.push(``);
  lines.push(`НА ЧТО СМОТРЕТЬ В ПЕРВЫЕ НЕДЕЛИ:`);
  r.watchpoints.forEach((w) => lines.push(`— [${TALENTS[w.id].name}, #${w.rank}] ${w.text}`));
  lines.push(``);
  lines.push(`═══════════════════════════════`);
  lines.push(``);
  lines.push(`ТОП-5 СИЛЬНЫХ СТОРОН:`);
  r.top5.forEach((t, i) => {
    const meta = TALENT_META[t.id] || {};
    lines.push(`${i + 1}. ${TALENTS[t.id].name} (#${t.rank}, ${t.pct}%) — ${TALENTS[t.id].description}`);
    if (meta.plus) lines.push(`   За: ${meta.plus}`);
    if (meta.risk) lines.push(`   Против: ${meta.risk}`);
  });
  lines.push(``);
  if (r.isRecommended) {
    lines.push(`РЕЙТИНГ СООТВЕТСТВИЯ ДОЛЖНОСТЯМ (все, по убыванию):`);
    r.roleMatches.forEach((m, i) => lines.push(`${i + 1}. ${m.roleName}: ${m.fit}%`));
  } else {
    lines.push(`СООТВЕТСТВИЕ ДОЛЖНОСТЯМ (топ-5):`);
    r.roleMatches.slice(0, 5).forEach((m) => lines.push(`— ${m.roleName}: ${m.fit}%`));
  }
  lines.push(``);
  lines.push(`НАИМЕНЕЕ ВЫРАЖЕНЫ (в целом): ` + r.bottom3.map((t) => `${TALENTS[t.id].name} (#${t.rank})`).join(", "));
  lines.push(``);
  lines.push(`ТОЧЕЧНЫЕ ВОПРОСЫ ДЛЯ СОБЕСЕДОВАНИЯ${r.isRecommended ? ` (под рекомендуемую должность «${r.role.name}»)` : ` (под должность «${r.role.name}»)`}:`);
  r.targetedQuestions.forEach((tq) => lines.push(`— [${TALENTS[tq.id].name}, #${tq.rank}] ${tq.q}`));
  if (r.developmentPlan.length > 0) {
    lines.push(``);
    lines.push(`═══ РЕКОМЕНДАЦИИ ПО РАЗВИТИЮ (для действующего сотрудника) ═══`);
    r.developmentPlan.forEach((d) => lines.push(`— [${TALENTS[d.id].name}, #${d.rank}, ${d.pct}%] ${d.tip}`));
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [activeTest, setActiveTest] = useState(null); // null | "clifton" | "rezultat" | "tools" | ...
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState(BRANCHES[0].id);
  const [applicantType, setApplicantType] = useState("candidate"); // candidate | employee
  const [positionId, setPositionId] = useState(ALL_POSITIONS[0].id);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [current, setCurrent] = useState(null);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [timeLeft, setTimeLeft] = useState(20);
  const [submitting, setSubmitting] = useState(false);

  const availablePositions = positionsForSchool(branchById(branchId).school);

  useEffect(() => {
    // если текущая должность недоступна для выбранного филиала (например тьютор для Клячки) — сбросить на первую доступную
    if (!availablePositions.find((p) => p.id === positionId)) {
      setPositionId(availablePositions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // таймер на пару — считает время, но НЕ пропускает вопрос автоматически.
  // При истечении 20 сек таймер продолжает расти (показывает перерасход),
  // чтобы HR видел среднее время на вопрос в будущем. Ответить можно всегда.
  useEffect(() => {
    if (screen !== "test") return;
    setTimeLeft(20);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      // отображаем оставшееся время (может уйти в минус — показываем 0)
      setTimeLeft(Math.max(0, 20 - elapsed));
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, qi]);

  function startTest() {
    if (!name.trim()) return;
    setAnswers([]); setQi(0); setCandidateEmail("");
    setScreen("test");
  }

  function backToHome() {
    setActiveTest(null);
    setScreen("home");
  }

  function answer(side) {
    const next = [...answers, side];
    setAnswers(next);
    if (qi + 1 < QUESTIONS.length) { setQi(qi + 1); return; }
    const schoolPositionIds = availablePositions.map((p) => p.id);
    const effectivePositionId = applicantType === "employee" ? positionId : null;
    const result = computeResult(next, effectivePositionId, schoolPositionIds);
    const rec = { id: Date.now().toString(36), name: name.trim(), positionId: effectivePositionId, branchId, applicantType, date: Date.now(), result, candidateEmail: "" };
    setCurrent(rec);
    setScreen("finish");
  }

  async function submitWithEmail() {
    if (submitting) return;
    setSubmitting(true);
    const rec = { ...current, candidateEmail: candidateEmail.trim() };
    setCurrent(rec);

    const withTimeout = (p, ms) => Promise.race([p, new Promise((resolve) => setTimeout(resolve, ms))]);

    const branchName = branchById(rec.branchId).name;
    const typeName = rec.applicantType === "employee" ? "Действующий сотрудник" : "Кандидат на собеседование";

    await Promise.allSettled([
      withTimeout(
        supabase.from("results").insert({
          candidate_name: rec.name,
          candidate_email: rec.candidateEmail,
          position_id: rec.positionId || rec.result.thisRoleFit.roleId,
          position_name: rec.result.role.name,
          position_recommended: rec.result.isRecommended,
          branch_id: rec.branchId,
          applicant_type: rec.applicantType,
          fit: rec.result.thisRoleFit.fit,
          top_talents: rec.result.top5.map((t) => ({ id: t.id, name: TALENTS[t.id].name, pct: t.pct })),
          role_matches: rec.result.roleMatches,
          report: buildPlainText(rec),
          report_json: JSON.stringify(rec.result),
        }).then((r) => { if (r.error) console.error(r.error); }).catch((e) => console.error(e)),
        8000
      ),
      withTimeout(
        fetch("https://formspree.io/f/mlgkpwey", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: `Результат теста: ${rec.name} — ${rec.result.role.name}`,
            candidate: rec.name,
            position: rec.result.role.name,
            branch: branchName,
            applicant_type: typeName,
            fit: `${rec.result.fit} (${rec.result.thisRoleFit.fit}%)`,
            candidate_email: rec.candidateEmail,
            report: buildPlainText(rec),
          }),
        }).catch((e) => console.error(e)),
        8000
      ),
    ]);

    setSubmitting(false);
    setScreen("thanks");
  }

  // ── ГЛАВНАЯ ──
  // Route to Опыт test
  if (activeTest === "rezultat") return (
    <RezultTest onBack={() => setActiveTest(null)} />
  );
  if (activeTest === "logis") return (
    <LogisTest onBack={() => setActiveTest(null)} />
  );
  if (activeTest === "sails") return (
    <SailsTest onBack={() => setActiveTest(null)} />
  );
  if (activeTest === "prim") return (
    <PrimTest onBack={() => setActiveTest(null)} />
  );
  if (activeTest === "tools") return (
    <ToolsTest onBack={() => setActiveTest(null)} />
  );

  if (activeTest === "clifton" && screen === "home") return (
    <TestStartLayout
      icon="🏆"
      eyebrow="Тест Клифтон"
      title="Сильные стороны и подходящие роли"
      description="В каждой паре выбирайте утверждение, которое ближе именно вам. Для кандидата роль будет рассчитана автоматически, для сотрудника можно указать текущую должность."
      accent="#D98E2B"
      meta={[
        { value: QUESTIONS.length, label: "пар" },
        { value: "45-50", label: "минут" },
        { value: "20", label: "талантов" },
      ]}
      onBack={backToHome}
    >
        <label style={startLabelStyle}>Имя</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Анна Петрова"
          style={startInputStyle} />

        <AudienceFields
          branchId={branchId}
          setBranchId={setBranchId}
          applicantType={applicantType}
          setApplicantType={setApplicantType}
        />

        {applicantType === "employee" && (
          <>
            <label style={{ ...startLabelStyle, margin: "18px 0 8px" }}>Ваша текущая должность</label>
            <select value={positionId} onChange={(e) => setPositionId(e.target.value)}
              style={startInputStyle}>
              {availablePositions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}

        <StartButton onClick={startTest} disabled={!name.trim()}>
          Начать тест
        </StartButton>
    </TestStartLayout>
  );

  if (screen === "home") return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ ...S.display, fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#8A867E", marginBottom: 12 }}>Оценка кандидатов</div>
        <h1 style={{ ...S.display, fontSize: 30, lineHeight: 1.15, margin: 0, fontWeight: 700 }}>Выберите тест</h1>
        <p style={{ color: "#6B675F", fontSize: 16, lineHeight: 1.55, marginTop: 12 }}>
          Единая точка входа для оценки сильных сторон, опыта, логики, продаж и личностного профиля.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px,1fr))", gap: 12, marginBottom: 24 }}>
        {TEST_CARDS.map((item) => (
          <HomeTestCard
            key={item.id}
            item={item}
            active={false}
            onClick={() => setActiveTest(item.id)}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 24 }}>
        {Object.entries(DOMAINS).map(([dname, d]) => (
          <div key={dname} style={{ background: d.soft, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, color: d.color, fontSize: 14 }}>{dname}</div>
          </div>
        ))}
      </div>
    </div></div>
  );

  // ── ТЕСТ ──
  if (screen === "test") {
    const q = QUESTIONS[qi];
    const pct = Math.round((qi / QUESTIONS.length) * 100);
    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, color: "#8A867E", fontWeight: 600 }}>{qi + 1} / {QUESTIONS.length}</span>
          <span style={{
            fontSize: 14, fontWeight: 700, minWidth: 32, height: 32, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: timeLeft === 0 ? "#E25C44" : timeLeft <= 5 ? "#FCEAE6" : "#F1EFEA",
            color: timeLeft === 0 ? "#fff" : timeLeft <= 5 ? "#E25C44" : "#1C1B1A",
          }}>{timeLeft === 0 ? "!" : timeLeft}</span>
        </div>
        <Bar pct={pct} color="#1C1B1A" />

        <div style={{ ...S.card, marginTop: 24, padding: "28px 24px" }}>
          <div style={{ fontSize: 13, color: "#8A867E", textAlign: "center", marginBottom: 16 }}>Что вам ближе?</div>
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => answer("A")} style={{ ...S.btn, textAlign: "left", background: "#F1EFEA", color: "#1C1B1A", padding: "18px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ ...S.display, fontWeight: 700, fontSize: 15, color: "#8A867E" }}>A</span>
              <span style={{ ...S.display, fontSize: 17, lineHeight: 1.35, fontWeight: 500 }}>{q.a}</span>
            </button>
            <button onClick={() => answer("B")} style={{ ...S.btn, textAlign: "left", background: "#F1EFEA", color: "#1C1B1A", padding: "18px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ ...S.display, fontWeight: 700, fontSize: 15, color: "#8A867E" }}>B</span>
              <span style={{ ...S.display, fontSize: 17, lineHeight: 1.35, fontWeight: 500 }}>{q.b}</span>
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: timeLeft === 0 ? "#E25C44" : "#8A867E", textAlign: "center" }}>
          {timeLeft === 0 ? "Не торопитесь — выбирайте то, что ближе." : "Выбирайте первой реакцией — не думайте слишком долго."}
        </p>
      </div></div>
    );
  }

  // ── ВВОД EMAIL ──
  if (screen === "finish") {
    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 480 }}>
        <div style={{ ...S.card, padding: "36px 28px", textAlign: "center", marginTop: 60 }}>
          <div style={{ ...S.display, fontSize: 24, fontWeight: 700 }}>Последний шаг</div>
          <p style={{ color: "#6B675F", lineHeight: 1.55, margin: "10px 0 22px" }}>
            Укажите ваш email, чтобы мы могли связаться с вами по результатам теста.
          </p>
          <input value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="you@mail.ru" type="email" disabled={submitting}
            style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 16, borderRadius: 12, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", textAlign: "center" }} />
          <button onClick={submitWithEmail} disabled={!candidateEmail.trim() || submitting}
            style={{ ...S.btn, ...S.primary, width: "100%", marginTop: 18, opacity: (candidateEmail.trim() && !submitting) ? 1 : 0.4 }}>
            {submitting ? "Отправка..." : "Завершить тест"}
          </button>
        </div>
      </div></div>
    );
  }

  // ── РЕЗУЛЬТАТЫ ДЛЯ КАНДИДАТА ──
  if (screen === "thanks" && current) {
    const top3 = current.result.top5.slice(0, 3);
    const domainColors = { "Исполнение": "#D98E2B", "Влияние": "#E25C44", "Отношения": "#2E9E87", "Мышление": "#6457D6" };
    const domainBg    = { "Исполнение": "#FBF1E2", "Влияние": "#FCEAE6", "Отношения": "#E4F4F0", "Мышление": "#ECEAFB" };
    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 560 }}>
        {/* Заголовок */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
          <h1 style={{ ...S.display, fontSize: 26, fontWeight: 700, margin: 0 }}>Тест завершён</h1>
          <p style={{ color: "#6B675F", fontSize: 15, lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
            Ваши результаты отправлены. Вот ваши три главных сильных стороны.
          </p>
        </div>

        {/* Топ-3 таланта */}
        {top3.map((t, i) => {
          const talent = TALENTS[t.id];
          const meta = TALENT_META[t.id] || {};
          const color = domainColors[talent.domain] || "#1C1B1A";
          const bg = domainBg[talent.domain] || "#F1EFEA";
          return (
            <div key={t.id} style={{ ...S.card, borderLeft: `5px solid ${color}`, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ ...S.display, fontSize: 22, fontWeight: 700, color: "#8A867E", minWidth: 28 }}>{i + 1}</div>
                <div>
                  <div style={{ ...S.display, fontSize: 18, fontWeight: 700 }}>{talent.name}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color, background: bg, padding: "2px 8px", borderRadius: 99 }}>
                    {talent.domain}
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, color: "#44413B", lineHeight: 1.6, fontSize: 15 }}>
                {talent.description}
              </p>
              {meta.plus && (
                <p style={{ margin: "10px 0 0", fontSize: 13, color: "#6B675F", lineHeight: 1.5, borderTop: "1px solid #EEECE7", paddingTop: 10 }}>
                  {meta.plus}
                </p>
              )}
            </div>
          );
        })}

        {/* Подсказка внизу */}
        <div style={{ ...S.card, background: "#F1EFEA", textAlign: "center", padding: "20px 24px" }}>
          <p style={{ margin: 0, color: "#6B675F", fontSize: 14, lineHeight: 1.6 }}>
            Полный профиль — у вашего руководителя или HR-специалиста.<br />
            Эту страницу можно закрыть.
          </p>
        </div>
      </div></div>
    );
  }

  return null;
}

export { computeResult, buildPlainText, DOMAINS, TALENT_META, TALENTS, ALL_POSITIONS as POSITIONS, MAX_BY_TALENT, S, Bar, DomainTag, BRANCHES, branchById, positionsForSchool };
