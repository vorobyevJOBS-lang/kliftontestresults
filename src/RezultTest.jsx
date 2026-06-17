import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { REZULTAT_QUESTIONS, TOTAL_QUESTIONS } from "./rezultMeta";

// ────────── helpers ──────────
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const QUESTION_TIME = 120; // 2 min per question

// ────────── AnswerField components ──────────
function RadioQuestion({ q, answer, onChange }) {
  if (q.buttonStyle) {
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange({ choice: opt })}
            style={{
              padding: "14px 32px",
              borderRadius: 10,
              border: answer?.choice === opt ? "2px solid #3B7BF6" : "2px solid #E0E0E0",
              background: answer?.choice === opt ? "#EEF3FF" : "#fff",
              color: answer?.choice === opt ? "#3B7BF6" : "#222",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: "#555", fontSize: 14, marginBottom: 4 }}>Выберите ответ:</div>
      {q.options.map((opt) => (
        <label
          key={opt}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          <input
            type="radio"
            name={`q${q.id}`}
            checked={answer?.choice === opt}
            onChange={() => onChange({ choice: opt })}
            style={{ width: 18, height: 18, accentColor: "#3B7BF6", cursor: "pointer" }}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function RadioWithComment({ q, answer, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: "#555", fontSize: 14, marginBottom: 4 }}>Выберите ответ:</div>
      {q.options.map((opt) => (
        <label
          key={opt}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 15 }}
        >
          <input
            type="radio"
            name={`q${q.id}`}
            checked={answer?.choice === opt}
            onChange={() => onChange({ choice: opt, comment: answer?.comment || "" })}
            style={{ width: 18, height: 18, accentColor: "#3B7BF6", cursor: "pointer" }}
          />
          {opt}
        </label>
      ))}
      {q.commentLabel && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>{q.commentLabel}</div>
          <textarea
            value={answer?.comment || ""}
            onChange={(e) => onChange({ choice: answer?.choice || "", comment: e.target.value })}
            placeholder={q.commentPlaceholder || "Введите комментарий"}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid #E0E0E0",
              fontSize: 14,
              resize: "vertical",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

function RadioWithTexts({ q, answer, onChange }) {
  const selected = answer?.choice || null;
  const texts = answer?.texts || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {q.options.map((opt, i) => (
        <div key={i}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 15 }}>
            <input
              type="radio"
              name={`q${q.id}`}
              checked={selected === String(i)}
              onChange={() => onChange({ choice: String(i), texts })}
              style={{ width: 18, height: 18, accentColor: "#3B7BF6", cursor: "pointer", marginTop: 2 }}
            />
            <span>{opt.label}</span>
          </label>
          {selected === String(i) && (
            <>
              <textarea
                value={texts[i] || ""}
                onChange={(e) =>
                  onChange({ choice: String(i), texts: { ...texts, [i]: e.target.value } })
                }
                placeholder={opt.placeholder || "Введите комментарий"}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: texts[i]?.trim() ? "1.5px solid #4CD080" : "1.5px solid #F0A030",
                  fontSize: 14,
                  resize: "vertical",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              {!texts[i]?.trim() && (
                <div style={{ fontSize: 12, color: "#F0A030", marginTop: 4 }}>Обязательное поле</div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function TextQuestion({ q, answer, onChange }) {
  return (
    <textarea
      value={answer?.text || ""}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder={q.placeholder || "Введите комментарий"}
      rows={5}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1.5px solid #E0E0E0",
        fontSize: 14,
        resize: "vertical",
        boxSizing: "border-box",
        outline: "none",
      }}
    />
  );
}

// ────────── Main component ──────────
export default function RezultTest({ onBack }) {
  const [stage, setStage] = useState("anketa"); // anketa | test | done
  const [anketa, setAnketa] = useState({
    firstName: "", lastName: "", age: "", phone: "", city: "",
    gender: "", previousTest: "", gdpr: false,
  });
  const [jobIndex, setJobIndex] = useState(0); // which job position (0 = first, 1 = second)
  const [allJobs, setAllJobs] = useState([{}]); // array of answer objects per job
  const [currentQ, setCurrentQ] = useState(0); // index in REZULTAT_QUESTIONS
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  const answers = allJobs[jobIndex] || {};

  function setAnswer(qId, val) {
    const updated = [...allJobs];
    updated[jobIndex] = { ...updated[jobIndex], [qId]: val };
    setAllJobs(updated);
  }

  // Timer
  useEffect(() => {
    if (stage !== "test") return;
    setTimeLeft(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage, currentQ, jobIndex]);

  function nextQuestion() {
    const q = REZULTAT_QUESTIONS[currentQ];
    // If last question and user says "Да" → add another job
    if (q.isLast) {
      const ans = answers[q.id];
      if (ans?.choice === "Да") {
        const updated = [...allJobs];
        updated.push({});
        setAllJobs(updated);
        setJobIndex(jobIndex + 1);
        setCurrentQ(2); // jump to Q3 (position) for second job
        return;
      } else {
        finishTest();
        return;
      }
    }
    if (currentQ < REZULTAT_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  }

  function prevQuestion() {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  }

  function startTest() {
    const { firstName, lastName, age, gdpr } = anketa;
    if (!firstName.trim() || !lastName.trim() || !age || !gdpr) {
      setError("Заполните обязательные поля: имя, фамилия, возраст и согласие на обработку данных");
      return;
    }
    setError("");
    setStage("test");
  }

  async function finishTest() {
    setSaving(true);
    try {
      const payload = {
        candidate_name: `${anketa.firstName.trim()} ${anketa.lastName.trim()}`,
        candidate_age: parseInt(anketa.age) || null,
        candidate_phone: anketa.phone.trim() || null,
        candidate_city: anketa.city.trim() || null,
        candidate_gender: anketa.gender || null,
        previous_test: anketa.previousTest === "Да",
        jobs: allJobs,
        answers_count: REZULTAT_QUESTIONS.length,
        completed: true,
      };
      const { error: dbErr } = await supabase.from("rezultat_results").insert([payload]);
      if (dbErr) throw dbErr;
      setStage("done");
    } catch (e) {
      console.error(e);
      setError("Ошибка сохранения: " + (e.message || "попробуйте снова"));
    } finally {
      setSaving(false);
    }
  }

  const progress = Math.round(((currentQ) / TOTAL_QUESTIONS) * 100);

  // ── АНКЕТА ──
  if (stage === "anketa") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F6FA", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "36px 40px", maxWidth: 560, width: "100%", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 28, color: "#111" }}>Анкета</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Ваше имя *</label>
              <input style={inputStyle} placeholder="Виталий" value={anketa.firstName}
                onChange={(e) => setAnketa({ ...anketa, firstName: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Ваша фамилия *</label>
              <input style={inputStyle} placeholder="Воробьёв" value={anketa.lastName}
                onChange={(e) => setAnketa({ ...anketa, lastName: e.target.value })} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Возраст *</label>
              <input style={inputStyle} type="number" placeholder="30" value={anketa.age}
                onChange={(e) => setAnketa({ ...anketa, age: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Телефон</label>
              <input style={inputStyle} placeholder="+7..." value={anketa.phone}
                onChange={(e) => setAnketa({ ...anketa, phone: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Город</label>
            <input style={inputStyle} placeholder="Красноярск" value={anketa.city}
              onChange={(e) => setAnketa({ ...anketa, city: e.target.value })} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Пол</label>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              {["Мужчина", "Женщина"].map((g) => (
                <button key={g} onClick={() => setAnketa({ ...anketa, gender: g })}
                  style={{
                    padding: "8px 22px", borderRadius: 8,
                    border: anketa.gender === g ? "2px solid #3B7BF6" : "2px solid #E0E0E0",
                    background: anketa.gender === g ? "#EEF3FF" : "#fff",
                    color: anketa.gender === g ? "#3B7BF6" : "#555",
                    fontWeight: 600, cursor: "pointer", fontSize: 14,
                  }}>{g}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Уже проходил тест</label>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              {["Да", "Нет"].map((v) => (
                <button key={v} onClick={() => setAnketa({ ...anketa, previousTest: v })}
                  style={{
                    padding: "8px 22px", borderRadius: 8,
                    border: anketa.previousTest === v ? "2px solid #3B7BF6" : "2px solid #E0E0E0",
                    background: anketa.previousTest === v ? "#EEF3FF" : "#fff",
                    color: anketa.previousTest === v ? "#3B7BF6" : "#555",
                    fontWeight: 600, cursor: "pointer", fontSize: 14,
                  }}>{v}</button>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 24, cursor: "pointer" }}>
            <input type="checkbox" checked={anketa.gdpr} onChange={(e) => setAnketa({ ...anketa, gdpr: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: "#3B7BF6", marginTop: 2 }} />
            <span style={{ fontSize: 13, color: "#555" }}>
              Я даю согласие на обработку моих персональных данных на условиях, указанных в Пользовательском соглашении
            </span>
          </label>

          {error && <div style={{ color: "#e53e3e", fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <div style={{ display: "flex", gap: 12 }}>
            {onBack && (
              <button onClick={onBack} style={{ ...btnSecondary }}>← Назад</button>
            )}
            <button onClick={startTest} style={{ ...btnPrimary, flex: 1 }}>Старт</button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (stage === "done") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F6FA", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Тест завершён!</h2>
          <p style={{ color: "#555", fontSize: 15, marginBottom: 28 }}>
            Спасибо, {anketa.firstName}! Ваши ответы сохранены. HR-специалист свяжется с вами.
          </p>
          {onBack && (
            <button onClick={onBack} style={btnPrimary}>← На главную</button>
          )}
        </div>
      </div>
    );
  }

  // ── TEST ──
  const q = REZULTAT_QUESTIONS[currentQ];
  const ans = answers[q.id];

  function canProceed() {
    // Обязательные текстовые поля
    if (q.required && q.type === "text" && !ans?.text?.trim()) return false;
    // radio_with_texts: нужно выбрать вариант И заполнить текстовое поле
    if (q.type === "radio_with_texts") {
      const idx = ans?.choice;
      if (idx === undefined || idx === null) return false; // не выбран вариант
      if (!ans?.texts?.[idx]?.trim()) return false; // текст пустой
    }
    return true;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6FA", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "36px 40px", maxWidth: 620, width: "100%", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13, color: "#888", fontFamily: "monospace", marginBottom: 2 }}>
              {formatTime(timeLeft)}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>
              Вопрос {q.id}
              {jobIndex > 0 && <span style={{ fontSize: 14, color: "#3B7BF6", marginLeft: 10 }}>Место работы #{jobIndex + 1}</span>}
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>{progress}% выполнено</div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "#E8EAED", borderRadius: 4, marginBottom: 28 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#3B7BF6", borderRadius: 4, transition: "width 0.3s" }} />
        </div>

        {/* Question */}
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#111", marginBottom: 24 }}>{q.question}</p>

        {/* Answer field */}
        {q.type === "radio" && (
          <RadioQuestion q={q} answer={ans} onChange={(v) => setAnswer(q.id, v)} />
        )}
        {q.type === "radio_with_comment" && (
          <RadioWithComment q={q} answer={ans} onChange={(v) => setAnswer(q.id, v)} />
        )}
        {q.type === "radio_with_texts" && (
          <RadioWithTexts q={q} answer={ans} onChange={(v) => setAnswer(q.id, v)} />
        )}
        {q.type === "text" && (
          <TextQuestion q={q} answer={ans} onChange={(v) => setAnswer(q.id, v)} />
        )}

        {error && <div style={{ color: "#e53e3e", fontSize: 13, marginTop: 12 }}>{error}</div>}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
          <button
            onClick={prevQuestion}
            disabled={currentQ === 0}
            style={{ ...btnSecondary, opacity: currentQ === 0 ? 0.4 : 1 }}
          >
            ← Назад
          </button>
          {(() => {
            // Заблокировать "Далее" если требуется комментарий, но он пустой
            const needsComment = q.type === "radio_with_comment" && q.commentLabel;
            const hasComment = ans?.comment && ans.comment.trim().length > 0;
            const needsText = q.type === "text";
            const hasText = ans?.text && ans.text.trim().length > 0;
            const blocked = saving || (needsComment && !hasComment) || (needsText && !hasText);
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {needsComment && !hasComment && (
                  <div style={{ fontSize: 12, color: "#E25C44" }}>⚠ Введите комментарий, чтобы продолжить</div>
                )}
                <button
                  onClick={nextQuestion}
                  disabled={blocked}
                  style={{ ...btnPrimary, opacity: blocked ? 0.45 : 1, cursor: blocked ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Сохранение..." : q.isLast ? "Завершить" : "Далее →"}
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── styles ──
const labelStyle = { fontSize: 13, color: "#555", display: "block", marginBottom: 4 };
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #E0E0E0", fontSize: 14, boxSizing: "border-box", outline: "none",
};
const btnPrimary = {
  padding: "13px 28px", borderRadius: 10, border: "none",
  background: "#3B7BF6", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
};
const btnSecondary = {
  padding: "13px 24px", borderRadius: 10, border: "2px solid #E0E0E0",
  background: "#fff", color: "#555", fontWeight: 600, fontSize: 14, cursor: "pointer",
};
