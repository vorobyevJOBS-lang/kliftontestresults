import { useState, useEffect, useRef, useCallback } from "react";
import { LOGIS_QUESTIONS, GEOM_SVG } from "./logisQuestions";
import { supabase } from "./supabase";
import AudienceFields from "./AudienceFields";
import { BRANCHES } from "./org";
import { insertWithOptionalOrg } from "./supabaseHelpers";
import TestStartLayout, { StartButton, StartNote, startInputStyle, startLabelStyle } from "./TestStartLayout";

// ─── SVG для паттерновых вопросов ────────────────────────────

function PatternQ33() {
  return (
    <svg viewBox="0 0 560 200" style={{ maxWidth: 540, width: "100%", display: "block", margin: "8px auto" }} xmlns="http://www.w3.org/2000/svg">
      {/* Это: 2x2 квадрата */}
      <text x="65" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">Это</text>
      <rect x="42" y="20" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="68" y="20" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="42" y="46" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="68" y="46" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      {/* → */}
      <text x="120" y="45" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      {/* соотносится: 5 кружков в + */}
      <text x="190" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">соотносится с этим</text>
      <circle cx="190" cy="43" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="162" cy="43" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="218" cy="43" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="190" cy="21" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="190" cy="65" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="162" y1="43" x2="218" y2="43" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="190" y1="21" x2="190" y2="65" stroke="currentColor" strokeWidth="1.5"/>
      {/* → */}
      <text x="252" y="45" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      {/* как это: 2x2 с X */}
      <text x="315" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">как это</text>
      <rect x="293" y="20" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="319" y="20" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="293" y="46" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="319" y="46" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="293" y1="20" x2="342" y2="69" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="342" y1="20" x2="293" y2="69" stroke="currentColor" strokeWidth="1.5"/>
      {/* → ? */}
      <text x="380" y="45" fontSize="18" textAnchor="middle" fill="currentColor">→ ?</text>
      {/* Варианты */}
      <text x="42" y="105" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">1</text>
      {/* вариант 1: 5 кружков с X-соединениями */}
      <circle cx="20" cy="145" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="64" cy="145" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="20" cy="175" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="64" cy="175" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="42" cy="160" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="20" y1="145" x2="64" y2="175" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="64" y1="145" x2="20" y2="175" stroke="currentColor" strokeWidth="1.5"/>
      <text x="175" y="105" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">2</text>
      {/* вариант 2: 9 кружков 3x3 */}
      {[0,1,2].map(r => [0,1,2].map(c => (
        <circle key={`${r}${c}`} cx={140 + c*22} cy={130 + r*22} r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      )))}
      <text x="330" y="105" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">3</text>
      {/* вариант 3: квадраты в + */}
      <rect x="307" y="118" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="332" y="143" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="282" y="143" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="307" y="168" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function PatternQ43() {
  return (
    <svg viewBox="0 0 540 200" style={{ maxWidth: 540, width: "100%", display: "block", margin: "8px auto" }} xmlns="http://www.w3.org/2000/svg">
      <text x="55" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">Это</text>
      <path d="M42,20 Q26,43 42,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M55,20 Q39,43 55,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M68,20 Q52,43 68,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <text x="120" y="45" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      <text x="195" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">соотносится с этим</text>
      <line x1="158" y1="28" x2="232" y2="28" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="158" y1="43" x2="232" y2="43" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="158" y1="58" x2="232" y2="58" stroke="currentColor" strokeWidth="2.5"/>
      <text x="268" y="45" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      <text x="350" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">как это</text>
      <path d="M325,20 Q305,43 325,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M342,20 Q322,43 342,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M359,20 Q339,43 359,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M376,20 Q356,43 376,66" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <text x="428" y="45" fontSize="18" textAnchor="middle" fill="currentColor">→ ?</text>
      {/* варианты */}
      <text x="55" y="105" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">1</text>
      <ellipse cx="55" cy="155" rx="40" ry="24" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <text x="210" y="105" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">2</text>
      <path d="M180,118 Q162,143 180,168" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M196,118 Q178,143 196,168" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M212,118 Q194,143 212,168" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M228,118 Q210,143 228,168" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <text x="380" y="105" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">3</text>
      <line x1="348" y1="128" x2="412" y2="128" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="348" y1="148" x2="412" y2="148" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="348" y1="168" x2="412" y2="168" stroke="currentColor" strokeWidth="2.5"/>
    </svg>
  );
}

function PatternQ52() {
  return (
    <svg viewBox="0 0 520 200" style={{ maxWidth: 520, width: "100%", display: "block", margin: "8px auto" }} xmlns="http://www.w3.org/2000/svg">
      <text x="52" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">Это</text>
      <rect x="14" y="18" width="76" height="62" fill="none" stroke="currentColor" strokeWidth="2"/>
      <polygon points="38,20 62,20 86,35 86,65 62,80 38,80 14,65 14,35" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="36" y="34" width="32" height="28" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <text x="132" y="52" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      <text x="213" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">соотносится с этим</text>
      <rect x="175" y="18" width="76" height="62" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="213" cy="49" r="26" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <text x="290" y="52" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      <text x="370" y="14" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">как это</text>
      <rect x="332" y="18" width="76" height="62" fill="none" stroke="currentColor" strokeWidth="2"/>
      <polygon points="370,22 406,49 370,76 334,49" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="370" cy="49" r="12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <text x="448" y="52" fontSize="18" textAnchor="middle" fill="currentColor">→ ?</text>
      {/* варианты */}
      <text x="52" y="108" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">1</text>
      <rect x="14" y="116" width="76" height="62" fill="none" stroke="currentColor" strokeWidth="2"/>
      <polygon points="52,120 88,147 52,174 16,147" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="16" y1="116" x2="90" y2="178" stroke="currentColor" strokeWidth="1"/>
      <line x1="90" y1="116" x2="16" y2="178" stroke="currentColor" strokeWidth="1"/>
      <circle cx="52" cy="147" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <text x="213" y="108" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">2</text>
      <rect x="175" y="116" width="76" height="62" fill="none" stroke="currentColor" strokeWidth="2"/>
      <polygon points="213,120 249,147 213,174 177,147" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <text x="370" y="108" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">3</text>
      <rect x="332" y="116" width="76" height="62" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="370" cy="147" r="26" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function PatternQ57() {
  // Крест → крест+кружки → трилистник → ?
  const Trefoil = ({ cx, cy, withDots }) => {
    const x = cx, y = cy;
    return (
      <g>
        <path d={`M${x},${y-10} Q${x-34},${y-10} ${x-34},${y-32} Q${x-34},${y-52} ${x-14},${y-52} Q${x+6},${y-52} ${x},${y-32} Z`} fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d={`M${x},${y-10} Q${x+34},${y-10} ${x+34},${y-32} Q${x+34},${y-52} ${x+14},${y-52} Q${x-6},${y-52} ${x},${y-32} Z`} fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d={`M${x},${y-10} Q${x-28},${y+8} ${x-20},${y+30} Q${x-12},${y+50} ${x},${y+36} Q${x+12},${y+50} ${x+20},${y+30} Q${x+28},${y+8} ${x},${y-10} Z`} fill="none" stroke="currentColor" strokeWidth="2"/>
        {withDots && <>
          <circle cx={x-28} cy={y-38} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={x+28} cy={y-38} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={x} cy={y+36} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={x} cy={y-10} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </>}
      </g>
    );
  };
  const Cross = ({ cx, cy, withDots }) => {
    const x = cx, y = cy;
    return (
      <g>
        <polygon points={`${x-18},${y-36} ${x+18},${y-36} ${x+18},${y-12} ${x+36},${y-12} ${x+36},${y+12} ${x+18},${y+12} ${x+18},${y+36} ${x-18},${y+36} ${x-18},${y+12} ${x-36},${y+12} ${x-36},${y-12} ${x-18},${y-12}`} fill="none" stroke="currentColor" strokeWidth="2"/>
        {withDots && <>
          <circle cx={x} cy={y-36} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={x} cy={y+36} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={x-36} cy={y} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx={x+36} cy={y} r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </>}
      </g>
    );
  };
  return (
    <svg viewBox="0 0 540 200" style={{ maxWidth: 540, width: "100%", display: "block", margin: "8px auto" }} xmlns="http://www.w3.org/2000/svg">
      <text x="52" y="12" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">Это</text>
      <Cross cx={52} cy={55} withDots={false}/>
      <text x="130" y="55" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      <text x="200" y="12" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">соотносится с этим</text>
      <Cross cx={200} cy={55} withDots={true}/>
      <text x="280" y="55" fontSize="18" textAnchor="middle" fill="currentColor">→</text>
      <text x="350" y="12" fontSize="11" textAnchor="middle" fill="currentColor" opacity=".7">как это</text>
      <Trefoil cx={350} cy={65} withDots={false}/>
      <text x="448" y="55" fontSize="18" textAnchor="middle" fill="currentColor">→ ?</text>
      {/* варианты */}
      <text x="52" y="112" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">1</text>
      <Trefoil cx={52} cy={160} withDots={false}/>
      <text x="200" y="112" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">2</text>
      <Trefoil cx={200} cy={160} withDots={true}/>
      <text x="380" y="112" fontSize="12" textAnchor="middle" fill="currentColor" fontWeight="bold">3</text>
      <Cross cx={380} cy={162} withDots={true}/>
    </svg>
  );
}

function QuestionDiagram({ svgType }) {
  if (svgType === "GEOM") {
    return <div dangerouslySetInnerHTML={{ __html: GEOM_SVG }} />;
  }
  if (svgType === "Q33") return <PatternQ33 />;
  if (svgType === "Q43") return <PatternQ43 />;
  if (svgType === "Q52") return <PatternQ52 />;
  if (svgType === "Q57") return <PatternQ57 />;
  return null;
}

// ─── УТИЛИТЫ ────────────────────────────────────────────────

const TOTAL_TIME = 30 * 60; // 30 минут в секундах

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── СТИЛИ ──────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#f5f5f5",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "0 0 40px",
  },
  header: {
    background: "#1e1e2e",
    color: "#fff",
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  timer: (urgent) => ({
    fontSize: 22,
    fontWeight: "bold",
    color: urgent ? "#ff6b6b" : "#7ee8a2",
    fontVariantNumeric: "tabular-nums",
  }),
  progress: {
    height: 4,
    background: "#e0e0e0",
  },
  progressBar: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    background: "#6c63ff",
    transition: "width 0.3s",
  }),
  wrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "0 16px",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "24px 28px",
    marginTop: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,.08)",
  },
  qNum: {
    fontSize: 13,
    color: "#888",
    marginBottom: 8,
  },
  qText: {
    fontSize: 17,
    lineHeight: 1.6,
    marginBottom: 16,
    whiteSpace: "pre-wrap",
  },
  missingBadge: {
    display: "inline-block",
    background: "#fff3cd",
    color: "#856404",
    borderRadius: 6,
    fontSize: 12,
    padding: "4px 10px",
    marginBottom: 12,
  },
  optionBtn: (selected) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 16px",
    marginBottom: 8,
    borderRadius: 8,
    border: selected ? "2px solid #6c63ff" : "2px solid #e8e8e8",
    background: selected ? "#f0eeff" : "#fafafa",
    cursor: "pointer",
    fontSize: 15,
    transition: "all .15s",
  }),
  navRow: {
    display: "flex",
    gap: 12,
    marginTop: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  btn: (variant) => ({
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    background: variant === "primary" ? "#6c63ff" : "#eee",
    color: variant === "primary" ? "#fff" : "#333",
  }),
  submitWrap: {
    textAlign: "center",
    marginTop: 32,
  },
  resultCard: {
    background: "#fff",
    borderRadius: 14,
    padding: "40px 32px",
    maxWidth: 480,
    margin: "40px auto",
    boxShadow: "0 4px 24px rgba(0,0,0,.1)",
    textAlign: "center",
  },
  scoreCircle: (score) => ({
    width: 130,
    height: 130,
    borderRadius: "50%",
    background: score >= 120 ? "#e8f5e9" : score >= 100 ? "#fff8e1" : "#ffebee",
    border: `5px solid ${score >= 120 ? "#43a047" : score >= 100 ? "#fb8c00" : "#e53935"}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
  }),
};

// ─── НАЧАЛЬНЫЙ ЭКРАН ────────────────────────────────────────

function StartScreen({ name, setName, email, setEmail, onStart, onBack, branchId, setBranchId, applicantType, setApplicantType }) {
  return (
    <TestStartLayout
      icon="🧠"
      eyebrow="Тест Логика"
      title="Логическое мышление"
      description="Короткий тест на внимательность, закономерности и скорость обработки информации."
      accent="#6C63FF"
      meta={[
        { value: "80", label: "вопросов" },
        { value: "30", label: "минут" },
        { value: "160", label: "баллов максимум" },
      ]}
      onBack={onBack}
    >
          <label style={startLabelStyle}>Имя</label>
          <input
            type="text"
            placeholder="Например: Анна Петрова"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={startInputStyle}
          />
          <label style={{ ...startLabelStyle, margin: "18px 0 8px" }}>Email <span style={{ fontWeight: 400, color: "#8A867E" }}>(для объединения тестов)</span></label>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={startInputStyle}
          />
            <AudienceFields
              branchId={branchId}
              setBranchId={setBranchId}
              applicantType={applicantType}
              setApplicantType={setApplicantType}
            />
          <StartNote>После начала таймер нельзя остановить.</StartNote>
          <StartButton onClick={onStart} disabled={!name.trim()}>
            Начать тест
          </StartButton>
    </TestStartLayout>
  );
}

// ─── РЕЗУЛЬТАТ ──────────────────────────────────────────────

function ResultScreen({ name, onBack }) {
  return (
    <div style={{ ...S.page, alignItems: "center", justifyContent: "center", display: "flex" }}>
      <div style={{ ...S.card, maxWidth: 420, textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#333", marginBottom: 8 }}>Тест завершён!</h2>
        <p style={{ color: "#888", fontSize: 15, marginBottom: 32 }}>
          Спасибо, {name}!<br />Ваши ответы сохранены.
        </p>
        <button style={S.btn("primary")} onClick={onBack}>На главную</button>
      </div>
    </div>
  );
}


export default function LogisTest({ onBack }) {
  const [phase, setPhase] = useState("start"); // start | test | result
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [branchId, setBranchId] = useState(BRANCHES[0].id);
  const [applicantType, setApplicantType] = useState("candidate");
  const timerRef = useRef(null);

  const q = LOGIS_QUESTIONS[current];
  const answered = Object.keys(answers).filter((k) => answers[k] !== undefined).length;

  const handleStart = () => {
    if (!name.trim()) return;
    setPhase("test");
  };

  const submit = useCallback(async () => {
    clearInterval(timerRef.current);
    let correct = 0;
    LOGIS_QUESTIONS.forEach((q) => {
      if (!q.missing && answers[q.id] === q.correct) correct++;
    });
    const score = 80 + correct;
    setResult({ score, correct });

    setSaving(true);
    try {
      await insertWithOptionalOrg(supabase, "logis_results", {
        name: name.trim(),
        candidate_email: email.trim() || null,
        score,
        correct_answers: correct,
        answers: JSON.stringify(answers),
        completed_at: new Date().toISOString(),
        branch_id: branchId,
        applicant_type: applicantType,
      });
    } catch (e) {
      console.error("Supabase save error:", e);
    }
    setSaving(false);
    setPhase("result");
  }, [answers, name, branchId, applicantType]);

  // Таймер
  useEffect(() => {
    if (phase !== "test") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          submit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, submit]);

  if (phase === "start") {
    return <StartScreen name={name} setName={setName} email={email} setEmail={setEmail} onStart={handleStart} onBack={onBack} branchId={branchId} setBranchId={setBranchId} applicantType={applicantType} setApplicantType={setApplicantType} />;
  }

  if (phase === "result" && result) {
    return <ResultScreen {...result} name={name} onBack={onBack} />;
  }

  const pct = Math.round(((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100);
  const urgent = timeLeft < 180;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button
          style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 13 }}
          onClick={() => { if (window.confirm("Выйти из теста? Прогресс будет потерян.")) onBack(); }}
        >
          ← Выход
        </button>
        <span style={{ fontSize: 14, color: "#aaa" }}>
          Вопрос {current + 1} / {LOGIS_QUESTIONS.length} · Отвечено: {answered}
        </span>
        <span style={S.timer(urgent)}>{formatTime(timeLeft)}</span>
      </div>
      <div style={S.progress}>
        <div style={S.progressBar(pct)} />
      </div>

      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.qNum}>Вопрос {q.id}</div>

          {q.missing && (
            <div style={S.missingBadge}>⚠ Вопрос не был зафиксирован — ответ не влияет на результат</div>
          )}

          {q.svgType && <QuestionDiagram svgType={q.svgType} />}

          <div style={S.qText}>{q.text}</div>

          <div>
            {q.options.map((opt, i) => {
              const idx = i + 1; // 1-indexed
              const selected = answers[q.id] === idx;
              return (
                <button
                  key={idx}
                  style={S.optionBtn(selected)}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [q.id]: idx }));
                    if (current < LOGIS_QUESTIONS.length - 1) {
                      setTimeout(() => setCurrent((c) => c + 1), 400);
                    }
                  }}
                >
                  <span style={{ color: "#888", marginRight: 10 }}>{idx}.</span> {opt}
                </button>
              );
            })}
          </div>

          <div style={S.navRow}>
            <button
              style={S.btn("default")}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              ← Назад
            </button>

            <span style={{ fontSize: 13, color: "#aaa" }}>
              {answers[q.id] ? `Ответ: ${answers[q.id]}` : "Не отвечено"}
            </span>

            {current < LOGIS_QUESTIONS.length - 1 ? (
              <button
                style={S.btn("primary")}
                onClick={() => setCurrent((c) => c + 1)}
              >
                Далее →
              </button>
            ) : (
              <button
                style={{ ...S.btn("primary"), background: "#43a047" }}
                onClick={() => {
                  const unanswered = LOGIS_QUESTIONS.length - answered;
                  if (unanswered > 0) {
                    if (!window.confirm(`Есть ${unanswered} вопрос(а) без ответа. Завершить тест?`)) return;
                  }
                  submit();
                }}
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Завершить тест ✓"}
              </button>
            )}
          </div>
        </div>

        {/* Навигация по вопросам */}
        <div style={{ ...S.card, marginTop: 16, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Быстрая навигация</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {LOGIS_QUESTIONS.map((q2, i) => {
              const isAnswered = answers[q2.id] !== undefined;
              const isCurrent = i === current;
              return (
                <button
                  key={q2.id}
                  onClick={() => setCurrent(i)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: isCurrent ? "2px solid #6c63ff" : "2px solid transparent",
                    background: isCurrent ? "#f0eeff" : isAnswered ? "#e8f5e9" : "#eee",
                    color: isCurrent ? "#6c63ff" : isAnswered ? "#2e7d32" : "#666",
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {q2.id}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
