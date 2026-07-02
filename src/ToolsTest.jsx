import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { TOOLS_QUESTIONS, TOTAL_QUESTIONS } from "./toolsQuestions";
import { TOOLS_INDICATORS, getToolsLevel, TOOLS_DESCRIPTIONS, LEVEL_STYLE } from "./toolsMeta";
import AudienceFields from "./AudienceFields";
import { BRANCHES } from "./org";
import { insertWithOptionalOrg } from "./supabaseHelpers";
import { getCandidateKey } from "./candidateIdentity";
import TestStartLayout, { StartButton, StartNote, startInputStyle, startLabelStyle } from "./TestStartLayout";

// ─────────────────────────────────────────────────────────────
// СКОРИНГ
// Каждый вопрос имеет scale (A–J) и direction (+1 или -1)
// Да  → +direction, Нет → -direction, Может быть → 0
// score = (сумма вкладов / 20) * 100  →  диапазон -100..+100
// ─────────────────────────────────────────────────────────────
const SCALE_TO_NAME = Object.fromEntries(TOOLS_INDICATORS.map(ind => [ind.id, ind.name]));

function computeToolsScores(answers) {
  // answers[i] = "Да" | "Может быть" | "Нет" | null
  const sums = {};
  TOOLS_INDICATORS.forEach(ind => { sums[ind.name] = 0; });

  answers.forEach((ans, i) => {
    if (!ans) return;
    const q = TOOLS_QUESTIONS[i];
    const indName = SCALE_TO_NAME[q.scale];
    const contribution = ans === "Да" ? q.direction : ans === "Нет" ? -q.direction : 0;
    sums[indName] += contribution;
  });

  const scores = {};
  TOOLS_INDICATORS.forEach(ind => {
    scores[ind.name] = Math.round((sums[ind.name] / 20) * 100);
  });
  return scores; // значения от -100 до +100
}

function computeSyndromes(scores) {
  const syndromes = [];
  const s = scores;

  // Активность / Настойчивость
  if (s["Активность"] >= 32 && s["Ответственность"] >= 32)
    syndromes.push("Инициативный");
  if (s["Активность"] < -32 && s["Настойчивость"] < -32)
    syndromes.push("Пассивный");

  // Уверенность vs. Общительность
  if (s["Уверенность"] >= 32 && s["Общительность"] < -32)
    syndromes.push("Одиночка");
  if (s["Чуткость"] >= 32 && s["Настойчивость"] < -32)
    syndromes.push("Плюшевый мишка");

  // Внимательность
  if (s["Внимательность"] >= 68)
    syndromes.push("Педант");

  // Активность / Настойчивость перевес
  if (s["Активность"] >= 68 && s["Ответственность"] < 0)
    syndromes.push("Может лениться");

  // Объективность
  if (s["Объективность"] < -32 && s["Позитивность"] < -32)
    syndromes.push("Критик");
  if (s["Объективность"] >= 68 && s["Позитивность"] >= 32)
    syndromes.push("Дипломат");

  // Общительность
  if (s["Общительность"] >= 68)
    syndromes.push("Звезда");

  return syndromes.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНОЕ
// ─────────────────────────────────────────────────────────────
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const S = {
  page: { minHeight: "100vh", background: "#F6F5F2", color: "#1C1B1A", fontFamily: "'Golos Text', system-ui, sans-serif" },
  wrap: { maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" },
  display: { fontFamily: "'Unbounded', 'Golos Text', sans-serif" },
  card: { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(28,27,26,.07)", marginBottom: 16 },
  btn: { border: "none", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 4, background: "#EEECE7", borderRadius: 99, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#1C1B1A", borderRadius: 99, transition: "width .3s ease" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ГЛАВНЫЙ КОМПОНЕНТ
// Props: onBack — вернуться на главную
// ─────────────────────────────────────────────────────────────
export default function ToolsTest({ onBack }) {
  const [screen, setScreen] = useState("form"); // form | test | saving | done
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState(Array(TOTAL_QUESTIONS).fill(null));
  const [timeLeft, setTimeLeft] = useState(35 * 60); // 35 мин в секундах
  const [saving, setSaving] = useState(false);
  const [savedScores, setSavedScores] = useState(null);
  const [branchId, setBranchId] = useState(BRANCHES[0].id);
  const [applicantType, setApplicantType] = useState("candidate");
  const timerRef = useRef(null);

  // Таймер (запускается когда screen === "test")
  useEffect(() => {
    if (screen !== "test") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          finishTest(answers);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen]);

  function startTest() {
    if (!name.trim()) return;
    setQi(0);
    setAnswers(Array(TOTAL_QUESTIONS).fill(null));
    setTimeLeft(35 * 60);
    setScreen("test");
  }

  function handleAnswer(value) {
    const newAnswers = [...answers];
    newAnswers[qi] = value;
    setAnswers(newAnswers);

    if (qi + 1 < TOTAL_QUESTIONS) {
      setQi(qi + 1);
    } else {
      clearInterval(timerRef.current);
      finishTest(newAnswers);
    }
  }

  function goBack() {
    if (qi > 0) setQi(qi - 1);
  }

  async function finishTest(finalAnswers) {
    clearInterval(timerRef.current);
    setSaving(true);
    setScreen("saving");

    const scores = computeToolsScores(finalAnswers);
    const syndromes = computeSyndromes(scores);
    const maybeCount = finalAnswers.filter(a => a === "Может быть").length;
    const answeredCount = finalAnswers.filter(a => a !== null).length;
    const timeSpent = 35 * 60 - timeLeft;

    const record = {
      candidate_name: name.trim(),
      candidate_age: age.trim() ? parseInt(age) : null,
      candidate_email: email.trim() || null,
      candidate_key: getCandidateKey({ email, name }),
      scores,
      syndromes,
      answers_count: answeredCount,
      total_questions: TOTAL_QUESTIONS,
      answered_count: answeredCount,
      time_spent: timeSpent,
      maybe_count: maybeCount,
      branch_id: branchId,
      applicant_type: applicantType,
    };

    const { error } = await insertWithOptionalOrg(supabase, "tools_results", record);
    if (error) console.error("Supabase error:", error);

    setSavedScores(scores);
    setSaving(false);
    setScreen("done");
  }

  // ── ФОРМА ──────────────────────────────────────────────────
  if (screen === "form") {
    return (
      <TestStartLayout
        icon="🎯"
        eyebrow="Тест Профиль"
        title="Характер и рабочий стиль"
        description="Оценка 10 рабочих показателей: как человек действует, принимает решения, общается и держит нагрузку."
        accent="#0F766E"
        meta={[
          { value: TOTAL_QUESTIONS, label: "вопросов" },
          { value: "35", label: "минут" },
          { value: "10", label: "показателей" },
        ]}
        onBack={onBack}
      >
          <label style={startLabelStyle}>Имя</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: Анна Петрова"
            style={startInputStyle}
          />

          <label style={{ ...startLabelStyle, margin: "18px 0 8px" }}>Возраст <span style={{ fontWeight: 400, color: "#8A867E" }}>(необязательно)</span></label>
          <input
            value={age}
            onChange={e => setAge(e.target.value.replace(/\D/g, ""))}
            placeholder="25"
            maxLength={3}
            style={startInputStyle}
          />

          <label style={{ ...startLabelStyle, margin: "18px 0 8px" }}>Email <span style={{ fontWeight: 400, color: "#8A867E" }}>(для объединения тестов)</span></label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            type="email"
            style={startInputStyle}
          />

          <AudienceFields
            branchId={branchId}
            setBranchId={setBranchId}
            applicantType={applicantType}
            setApplicantType={setApplicantType}
          />

          <StartNote>
            ⏱ У вас 35 минут. Отвечайте первым импульсом — не думайте слишком долго.
          </StartNote>

          <StartButton onClick={startTest} disabled={!name.trim()}>
            Начать тест
          </StartButton>
      </TestStartLayout>
    );
  }

  // ── ТЕСТ ───────────────────────────────────────────────────
  if (screen === "test") {
    const pct = Math.round((qi / TOTAL_QUESTIONS) * 100);
    const isLowTime = timeLeft < 5 * 60;
    const ind = TOOLS_INDICATORS.find(i => i.id === TOOLS_QUESTIONS[qi].scale) || TOOLS_INDICATORS[0];

    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 580 }}>

        {/* Шапка: прогресс + таймер */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#8A867E", fontWeight: 600 }}>
            {qi + 1} / {TOTAL_QUESTIONS}
          </span>
          <span style={{
            fontSize: 15, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
            background: isLowTime ? "#FCEAE6" : "#F1EFEA",
            color: isLowTime ? "#E25C44" : "#44413B",
          }}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>

        <ProgressBar pct={pct} />

        {/* Вопрос */}
        <div style={{ ...S.card, padding: "28px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ind.color, display: "inline-block" }} />
            Вопрос {qi + 1}
          </div>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, fontWeight: 500 }}>
            {TOOLS_QUESTIONS[qi].text}
          </p>
        </div>

        {/* Кнопки ответа */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {["Да", "Может быть", "Нет"].map(opt => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              style={{
                ...S.btn,
                padding: "18px 24px",
                textAlign: "left",
                background: "#fff",
                color: "#1C1B1A",
                fontSize: 16,
                boxShadow: "0 1px 3px rgba(28,27,26,.06)",
                transition: "background .15s, transform .1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1EFEA"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "none"; }}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* Назад */}
        {qi > 0 && (
          <button
            onClick={goBack}
            style={{ ...S.btn, background: "transparent", color: "#8A867E", fontSize: 13, padding: "8px 0", width: "100%" }}
          >
            ← Предыдущий вопрос
          </button>
        )}
      </div></div>
    );
  }

  // ── СОХРАНЕНИЕ ─────────────────────────────────────────────
  if (screen === "saving") {
    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 400, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ ...S.display, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Обрабатываем результаты...</div>
        <div style={{ color: "#6B675F", fontSize: 15 }}>Секунду, сохраняем ваш профиль.</div>
      </div></div>
    );
  }

  // ── ЗАВЕРШЕНИЕ ─────────────────────────────────────────────
  if (screen === "done" && savedScores) {
    // Показываем кандидату топ-3 наиболее выраженных показателя
    const sorted = TOOLS_INDICATORS
      .map(ind => ({ ind, score: savedScores[ind.name] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 560 }}>
        <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h1 style={{ ...S.display, fontSize: 26, fontWeight: 700, margin: "0 0 10px" }}>Тест завершён!</h1>
          <p style={{ color: "#6B675F", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Ваши результаты сохранены. Вот ваши три самых выраженных качества.
          </p>
        </div>

        {sorted.map(({ ind, score }, i) => {
          const level = getToolsLevel(score);
          const ls = LEVEL_STYLE[level];
          const desc = TOOLS_DESCRIPTIONS[ind.name]?.[level] || "";
          return (
            <div key={ind.id} style={{ ...S.card, borderLeft: `5px solid ${ind.color}`, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ ...S.display, fontSize: 22, fontWeight: 700, color: "#8A867E", minWidth: 28 }}>{i + 1}</div>
                <div>
                  <div style={{ ...S.display, fontSize: 17, fontWeight: 700 }}>{ind.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: ls.color, background: ls.bg, padding: "2px 8px", borderRadius: 99 }}>
                    {level}
                  </span>
                </div>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 14, color: ind.color }}>
                  {score > 0 ? `+${score}` : score}
                </span>
              </div>
              {desc && <p style={{ margin: 0, fontSize: 14, color: "#44413B", lineHeight: 1.6 }}>{desc}</p>}
            </div>
          );
        })}

        <div style={{ ...S.card, background: "#F6F5F2", textAlign: "center", padding: "20px 24px" }}>
          <p style={{ margin: 0, color: "#6B675F", fontSize: 14, lineHeight: 1.6 }}>
            Полный профиль со всеми 10 показателями — у вашего HR-специалиста.<br />
            Эту страницу можно закрыть.
          </p>
        </div>
      </div></div>
    );
  }

  return null;
}
