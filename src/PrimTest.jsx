import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { PRIM_QUESTIONS, PRIM_TOTAL } from "./primQuestions";
import { PRIM_FACTORS, PRIM_SCALE_TO_NAME, getPrimLevel, PRIM_LEVEL_STYLE, PRIM_DESCRIPTIONS } from "./primMeta";
import AudienceFields from "./AudienceFields";
import { BRANCHES } from "./org";
import { insertWithOptionalOrg } from "./supabaseHelpers";
import { getCandidateKey } from "./candidateIdentity";
import TestStartLayout, { StartButton, StartNote, startInputStyle, startLabelStyle } from "./TestStartLayout";

// ─────────────────────────────────────────────────────────────
// СКОРИНГ
// Каждый вопрос: scale (A–H), direction (+1 / -1)
// Да → +direction, Нет → -direction, Может быть → 0
// score = (сумма / 20) * 100  → диапазон -100..+100
// ─────────────────────────────────────────────────────────────
function computePrimScores(answers) {
  const sums = {};
  PRIM_FACTORS.forEach(f => { sums[f.name] = 0; });

  answers.forEach((ans, i) => {
    if (!ans) return;
    const q = PRIM_QUESTIONS[i];
    const name = PRIM_SCALE_TO_NAME[q.scale];
    const contribution = ans === "Да" ? q.direction : ans === "Нет" ? -q.direction : 0;
    sums[name] += contribution;
  });

  const scores = {};
  PRIM_FACTORS.forEach(f => {
    scores[f.name] = Math.round((sums[f.name] / 20) * 100);
  });
  return scores;
}

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

export default function PrimTest({ onBack }) {
  const [screen, setScreen] = useState("form");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState(Array(PRIM_TOTAL).fill(null));
  const [timeLeft, setTimeLeft] = useState(36 * 60);
  const [savedScores, setSavedScores] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [branchId, setBranchId] = useState(BRANCHES[0].id);
  const [applicantType, setApplicantType] = useState("candidate");
  const timerRef = useRef(null);

  useEffect(() => {
    if (screen !== "test") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); finishTest(answers); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen]);

  function startTest() {
    if (!name.trim()) return;
    setQi(0);
    setAnswers(Array(PRIM_TOTAL).fill(null));
    setTimeLeft(36 * 60);
    setScreen("test");
  }

  function handleAnswer(value) {
    const newAnswers = [...answers];
    newAnswers[qi] = value;
    setAnswers(newAnswers);
    if (qi + 1 < PRIM_TOTAL) {
      setQi(qi + 1);
    } else {
      clearInterval(timerRef.current);
      finishTest(newAnswers);
    }
  }

  function goBack() { if (qi > 0) setQi(qi - 1); }

  async function finishTest(finalAnswers) {
    clearInterval(timerRef.current);
    setScreen("saving");

    const scores = computePrimScores(finalAnswers);
    const maybeCount = finalAnswers.filter(a => a === "Может быть").length;
    const answeredCount = finalAnswers.filter(a => a !== null).length;
    const timeSpent = 36 * 60 - timeLeft;

    const record = {
      candidate_name: name.trim(),
      candidate_age: age.trim() ? parseInt(age) : null,
      candidate_email: email.trim() || null,
      candidate_key: getCandidateKey({ email, name }),
      scores,
      answers_count: answeredCount,
      total_questions: PRIM_TOTAL,
      time_spent: timeSpent,
      maybe_count: maybeCount,
      branch_id: branchId,
      applicant_type: applicantType,
    };

    const { error } = await insertWithOptionalOrg(supabase, "prim_results", record);
    if (error) {
      console.error("Supabase error:", error);
      setSaveError(error.message || "Не удалось сохранить результат.");
      setScreen("save_error");
      return;
    }

    setSavedScores(scores);
    setScreen("done");
  }

  // ── ФОРМА ──────────────────────────────────────────────────
  if (screen === "form") {
    return (
      <TestStartLayout
        icon="🧭"
        eyebrow="Первичный анализ"
        title="Личностный профиль кандидата"
        description="Быстрый профиль по 8 факторам: энергия, ответственность, коммуникация, обучаемость и зоны риска."
        accent="#7C3AED"
        meta={[
          { value: PRIM_TOTAL, label: "вопросов" },
          { value: "30-36", label: "минут" },
          { value: "8", label: "факторов" },
        ]}
        onBack={onBack}
      >
          <label style={startLabelStyle}>Имя</label>
          <input
            value={name} onChange={e => setName(e.target.value)} placeholder="Например: Анна Петрова"
            style={startInputStyle}
          />
          <label style={{ ...startLabelStyle, margin: "18px 0 8px" }}>Возраст <span style={{ fontWeight: 400, color: "#8A867E" }}>(необязательно)</span></label>
          <input
            value={age} onChange={e => setAge(e.target.value.replace(/\D/g, ""))} placeholder="25" maxLength={3}
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
            ⏱ У вас 30 минут. Отвечайте первым импульсом — не думайте слишком долго.
          </StartNote>
          <StartButton onClick={startTest} disabled={!name.trim()}>Начать тест</StartButton>
      </TestStartLayout>
    );
  }

  // ── ТЕСТ ───────────────────────────────────────────────────
  if (screen === "test") {
    const pct = Math.round((qi / PRIM_TOTAL) * 100);
    const isLowTime = timeLeft < 5 * 60;
    const q = PRIM_QUESTIONS[qi];
    const factor = PRIM_FACTORS.find(f => f.id === q.scale) || PRIM_FACTORS[0];

    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 580 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#8A867E", fontWeight: 600 }}>{qi + 1} / {PRIM_TOTAL}</span>
          <span style={{ fontSize: 15, fontWeight: 700, padding: "4px 14px", borderRadius: 20, background: isLowTime ? "#FCEAE6" : "#F1EFEA", color: isLowTime ? "#E25C44" : "#44413B" }}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>
        <ProgressBar pct={pct} />
        <div style={{ ...S.card, padding: "28px 24px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: factor.color, display: "inline-block" }} />
            Вопрос {qi + 1}
          </div>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, fontWeight: 500 }}>{q.text}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {["Да", "Может быть", "Нет"].map(opt => (
            <button key={opt} onClick={() => handleAnswer(opt)}
              style={{ ...S.btn, padding: "18px 24px", textAlign: "left", background: "#fff", color: "#1C1B1A", fontSize: 16, boxShadow: "0 1px 3px rgba(28,27,26,.06)", transition: "background .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1EFEA"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
            >{opt}</button>
          ))}
        </div>
        {qi > 0 && (
          <button onClick={goBack} style={{ ...S.btn, background: "transparent", color: "#8A867E", fontSize: 13, padding: "8px 0", width: "100%" }}>← Предыдущий вопрос</button>
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

  if (screen === "save_error") {
    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 460, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>!</div>
        <div style={{ ...S.display, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Результат не сохранился</div>
        <p style={{ color: "#6B675F", fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>
          Проверьте интернет и попробуйте отправить ещё раз. Ошибка: {saveError}
        </p>
        <button
          onClick={() => finishTest(answers)}
          style={{ ...S.btn, background: "#1C1B1A", color: "#fff", width: "100%", padding: "14px 20px" }}
        >
          Повторить сохранение
        </button>
      </div></div>
    );
  }

  // ── ЗАВЕРШЕНИЕ (показываем только топ-3) ───────────────────
  if (screen === "done" && savedScores) {
    const top3 = PRIM_FACTORS
      .map(f => ({ f, score: savedScores[f.name] }))
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
        {top3.map(({ f, score }, i) => {
          const level = getPrimLevel(score);
          const ls = PRIM_LEVEL_STYLE[level];
          const desc = PRIM_DESCRIPTIONS[f.name]?.[level] || "";
          return (
            <div key={f.id} style={{ ...S.card, borderLeft: `5px solid ${f.color}`, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: desc ? 10 : 0 }}>
                <div style={{ ...S.display, fontSize: 22, fontWeight: 700, color: "#8A867E", minWidth: 28 }}>{i + 1}</div>
                <div>
                  <div style={{ ...S.display, fontSize: 17, fontWeight: 700 }}>{f.icon} {f.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: ls.color, background: ls.bg, padding: "2px 8px", borderRadius: 99 }}>{level}</span>
                </div>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 14, color: f.color }}>{score > 0 ? `+${score}` : score}</span>
              </div>
              {desc && <p style={{ margin: 0, fontSize: 14, color: "#44413B", lineHeight: 1.6 }}>{desc}</p>}
            </div>
          );
        })}
        <div style={{ ...S.card, background: "#F6F5F2", textAlign: "center", padding: "20px 24px" }}>
          <p style={{ margin: 0, color: "#6B675F", fontSize: 14, lineHeight: 1.6 }}>
            Полный профиль со всеми 8 факторами — у вашего HR-специалиста.<br />
            Эту страницу можно закрыть.
          </p>
        </div>
      </div></div>
    );
  }

  return null;
}
