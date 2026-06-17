import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { SAILS_QUESTIONS, SAILS_OPTIONS, SAILS_SCALE_NAMES, calcSailsScales, sailsLevel } from "./sailsQuestions";

const TOTAL_TIME = 30 * 60;

function StartScreen({ onStart }) {
  const [name, setName] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: "24px", padding: "48px", maxWidth: "520px", width: "100%", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>💎</div>
        <h1 style={{ color: "#fff", fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>Тест Сэйлс</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "32px", lineHeight: "1.6" }}>
          120 вопросов · 30 минут<br />
          Оцените своё отношение к работе в продажах
        </p>
        <div style={{ marginBottom: "24px", textAlign: "left" }}>
          <label style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", display: "block", marginBottom: "8px" }}>Ваше имя</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Введите имя..."
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" }}
            onKeyDown={e => e.key === "Enter" && name.trim() && onStart(name.trim())}
          />
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", margin: 0, lineHeight: "1.7" }}>
            На каждый вопрос есть три варианта ответа: <strong style={{ color: "#fff" }}>Да</strong>, <strong style={{ color: "#fff" }}>Иногда</strong>, <strong style={{ color: "#fff" }}>Нет</strong>.<br />
            Отвечайте искренне — правильных и неправильных ответов нет.
          </p>
        </div>
        <button
          onClick={() => name.trim() && onStart(name.trim())}
          disabled={!name.trim()}
          style={{ width: "100%", padding: "14px", background: name.trim() ? "linear-gradient(135deg, #e040fb, #9c27b0)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "16px", fontWeight: "600", cursor: name.trim() ? "pointer" : "not-allowed", transition: "all 0.2s" }}
        >
          Начать тест
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ name, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: "24px", padding: "48px", maxWidth: "480px", width: "100%", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ color: "#fff", fontSize: "26px", fontWeight: "700", marginBottom: "8px" }}>Тест завершён!</h2>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "32px", lineHeight: "1.7" }}>
          Спасибо, {name}!<br />Ваши ответы сохранены.
        </p>
        <button onClick={onBack} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "#fff", fontSize: "16px", cursor: "pointer" }}>
          На главную
        </button>
      </div>
    </div>
  );
}


export default function SailsTest({ onBack }) {
  const [screen, setScreen] = useState("start");
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState({});
  const [scales, setScales] = useState(null);
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [submitted, setSubmitted] = useState(false);
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

  const handleStart = (n) => { setName(n); setScreen("test"); };

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
      await supabase.from("sails_results").insert([{
        name,
        answers: finalAnswers,
        scales: scaleScores,
        completed_at: new Date().toISOString(),
      }]);
    } catch (e) { console.error(e); }
    setScreen("result");
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (screen === "start") return <StartScreen onStart={handleStart} />;
  if (screen === "result") return <ResultScreen name={name} answers={answers} scales={scales} onBack={onBack} />;

  const q = SAILS_QUESTIONS[current];
  const answered = Object.keys(answers).length;
  const progress = (answered / SAILS_QUESTIONS.length) * 100;
  const isLowTime = timeLeft < 300;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "14px", padding: "4px 8px" }}>← Выход</button>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", fontWeight: "600" }}>💎 Тест Сэйлс</span>
        <span style={{ color: isLowTime ? "#f44336" : "rgba(255,255,255,0.7)", fontSize: "16px", fontWeight: "700", fontFamily: "monospace" }}>{formatTime(timeLeft)}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: "3px", background: "rgba(255,255,255,0.1)" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #e040fb, #9c27b0)", transition: "width 0.3s" }} />
      </div>

      {/* Question */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "640px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Вопрос {current + 1} из {SAILS_QUESTIONS.length}</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "20px", padding: "32px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "24px", textAlign: "center" }}>
            <p style={{ color: "#fff", fontSize: "18px", lineHeight: "1.7", margin: 0, fontWeight: "500" }}>{q.text}</p>
          </div>

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            {SAILS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                style={{
                  padding: "18px 12px",
                  background: answers[q.id] === opt.value ? "linear-gradient(135deg, #e040fb, #9c27b0)" : "rgba(255,255,255,0.07)",
                  border: answers[q.id] === opt.value ? "none" : "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "14px",
                  color: "#fff",
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
      <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
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
                background: i === current ? "#e040fb" : answers[SAILS_QUESTIONS[i].id] ? "#4caf50" : "rgba(255,255,255,0.1)",
                color: "#fff",
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
              style={{ padding: "10px 32px", background: "linear-gradient(135deg, #e040fb, #9c27b0)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
            >
              Завершить тест
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
