import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { SAILS_QUESTIONS, SAILS_OPTIONS, SAILS_SCALE_NAMES, calcSailsScales, sailsLevel } from "./sailsQuestions";
import AudienceFields from "./AudienceFields";
import { BRANCHES } from "./org";
import { insertWithOptionalOrg } from "./supabaseHelpers";
import { getCandidateKey } from "./candidateIdentity";
import TestStartLayout, { StartButton, StartNote, startInputStyle, startLabelStyle } from "./TestStartLayout";

const TOTAL_TIME = 30 * 60;

function StartScreen({ onStart, onBack, initialName = "", initialEmail = "", initialBranchId = BRANCHES[0].id, initialApplicantType = "candidate" }) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [applicantType, setApplicantType] = useState(initialApplicantType);
  const start = () => name.trim() && onStart(name.trim(), email.trim(), branchId, applicantType);
  return (
    <TestStartLayout
      icon="💎"
      eyebrow="Тест Продажник"
      title="Потенциал в продажах"
      description="Оценка отношения к продажам, устойчивости, организованности, командности и ориентации на результат."
      accent="#9C27B0"
      meta={[
        { value: "120", label: "вопросов" },
        { value: "30", label: "минут" },
        { value: "10", label: "шкал" },
      ]}
      onBack={onBack}
    >
          <label style={startLabelStyle}>Имя</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: Анна Петрова"
            style={startInputStyle}
            onKeyDown={e => e.key === "Enter" && start()}
          />
          <label style={{ ...startLabelStyle, margin: "18px 0 8px" }}>Email <span style={{ fontWeight: 400, color: "#8A867E" }}>(для объединения тестов)</span></label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            type="email"
            style={startInputStyle}
            onKeyDown={e => e.key === "Enter" && start()}
          />
          <AudienceFields
            branchId={branchId}
            setBranchId={setBranchId}
            applicantType={applicantType}
            setApplicantType={setApplicantType}
          />
        <StartNote>
            На каждый вопрос есть три варианта ответа: <strong>Да</strong>, <strong>Иногда</strong>, <strong>Нет</strong>.<br />
            Отвечайте искренне — правильных и неправильных ответов нет.
        </StartNote>
        <StartButton onClick={start} disabled={!name.trim()}>
          Начать тест
        </StartButton>
    </TestStartLayout>
  );
}

function ResultScreen({ name, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 80% 0, #e3efe7 0, transparent 28rem), #f4f6f2", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "24px", padding: "48px", maxWidth: "480px", width: "100%", border: "1px solid #dfe6dd", boxShadow: "0 14px 38px rgba(22,69,47,.08)", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ color: "#17211b", fontSize: "26px", fontWeight: "700", marginBottom: "8px" }}>Тест завершён!</h2>
        <p style={{ color: "#647068", fontSize: "15px", marginBottom: "32px", lineHeight: "1.7" }}>
          Спасибо, {name}!<br />Ваши ответы сохранены.
        </p>
        <button onClick={onBack} style={{ width: "100%", padding: "14px", background: "#e8eee9", border: "1px solid #d7dfd6", borderRadius: "12px", color: "#213128", fontSize: "16px", cursor: "pointer", fontWeight: 700 }}>
          На главную
        </button>
      </div>
    </div>
  );
}


export default function SailsTest({ onBack, initialName = "", initialEmail = "", initialBranchId = BRANCHES[0].id, initialApplicantType = "candidate" }) {
  const [screen, setScreen] = useState("start");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState({});
  const [scales, setScales] = useState(null);
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [branchId, setBranchId] = useState(BRANCHES[0].id);
  const [applicantType, setApplicantType] = useState("candidate");
  const timerRef = useRef(null);

  useEffect(() => {
    if (screen === "test") {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const handleStart = (n, selectedEmail, selectedBranchId, selectedApplicantType) => {
    setName(n);
    setEmail(selectedEmail);
    setBranchId(selectedBranchId);
    setApplicantType(selectedApplicantType);
    setScreen("test");
  };

  const handleAnswer = (val) => {
    const qId = SAILS_QUESTIONS[current].id;
    const newAnswers = { ...answers, [qId]: val };
    setAnswers(newAnswers);
    if (current < SAILS_QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
    } else {
      handleSubmit(false, newAnswers);
    }
  };

  const handleSubmit = async (timeout = false, finalAnswers = answers) => {
    if (submitted) return;
    setSubmitted(true);
    clearInterval(timerRef.current);
    const scaleScores = calcSailsScales(finalAnswers);
    setScales(scaleScores);
    try {
      await insertWithOptionalOrg(supabase, "sails_results", {
        name,
        candidate_email: email || null,
        candidate_key: getCandidateKey({ email, name }),
        answers: finalAnswers,
        scales: scaleScores,
        completed_at: new Date().toISOString(),
        branch_id: branchId,
        applicant_type: applicantType,
      });
    } catch (e) { console.error(e); }
    setScreen("result");
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (screen === "start") return <StartScreen onStart={handleStart} onBack={onBack} initialName={initialName} initialEmail={initialEmail} initialBranchId={initialBranchId} initialApplicantType={initialApplicantType} />;
  if (screen === "result") return <ResultScreen name={name} answers={answers} scales={scales} onBack={onBack} />;

  const q = SAILS_QUESTIONS[current];
  const answered = Object.keys(answers).length;
  const progress = (answered / SAILS_QUESTIONS.length) * 100;
  const isLowTime = timeLeft < 300;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 80% 0, #e3efe7 0, transparent 28rem), #f4f6f2", color: "#17211b", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #dfe6dd", background: "rgba(250,251,248,.96)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#536057", cursor: "pointer", fontSize: "14px", padding: "4px 8px" }}>← Выход</button>
        <span style={{ color: "#1f6f4e", fontSize: "14px", fontWeight: "700" }}>💎 Оценка продаж</span>
        <span style={{ color: isLowTime ? "#9d332c" : "#1f6f4e", fontSize: "16px", fontWeight: "700", fontFamily: "monospace" }}>{formatTime(timeLeft)}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: "4px", background: "#dfe6dd" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "#1f6f4e", transition: "width 0.3s" }} />
      </div>

      {/* Question */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "640px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <span style={{ color: "#748077", fontSize: "13px" }}>Вопрос {current + 1} из {SAILS_QUESTIONS.length}</span>
          </div>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", border: "1px solid #dfe6dd", boxShadow: "0 14px 38px rgba(22,69,47,.07)", marginBottom: "24px", textAlign: "center" }}>
            <p style={{ color: "#17211b", fontSize: "18px", lineHeight: "1.7", margin: 0, fontWeight: "500" }}>{q.text}</p>
          </div>

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            {SAILS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                style={{
                  padding: "18px 12px",
                  background: answers[q.id] === opt.value ? "#1f6f4e" : "#fff",
                  border: answers[q.id] === opt.value ? "1px solid #1f6f4e" : "1px solid #cfd8cf",
                  borderRadius: "14px",
                  color: answers[q.id] === opt.value ? "#fff" : "#213128",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation grid */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid #dfe6dd", background: "rgba(250,251,248,.9)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center", maxWidth: "640px", margin: "0 auto" }}>
          {SAILS_QUESTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: "22px", height: "22px",
                borderRadius: "4px",
                border: "none",
                fontSize: "9px",
                cursor: "pointer",
                background: i === current ? "#1f6f4e" : answers[SAILS_QUESTIONS[i].id] ? "#9fc8aa" : "#dfe6dd",
                color: i === current ? "#fff" : "#213128",
                fontWeight: i === current ? "700" : "400",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "12px" }}>
          {answered >= SAILS_QUESTIONS.length - 1 && (
            <button
              onClick={() => handleSubmit(false)}
              style={{ padding: "10px 32px", background: "#1f6f4e", border: "none", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
            >
              Завершить тест
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
