import { useState } from "react";
import { REZULTAT_QUESTIONS } from "./rezultMeta";

function getAnswerText(q, ans) {
  if (!ans) return <span style={{ color: "#bbb" }}>— не отвечено —</span>;
  if (q.type === "text") return ans.text || <span style={{ color: "#bbb" }}>пусто</span>;
  if (q.type === "radio") return ans.choice || <span style={{ color: "#bbb" }}>пусто</span>;
  if (q.type === "radio_with_comment") {
    return (
      <div>
        <span style={{ fontWeight: 600 }}>{ans.choice || "—"}</span>
        {ans.comment && <div style={{ color: "#555", fontSize: 13, marginTop: 4 }}>{ans.comment}</div>}
      </div>
    );
  }
  if (q.type === "radio_with_texts") {
    const idx = parseInt(ans.choice ?? "-1");
    if (idx < 0 || !q.options[idx]) return <span style={{ color: "#bbb" }}>пусто</span>;
    return (
      <div>
        <span style={{ fontWeight: 600 }}>{q.options[idx].label}</span>
        {ans.texts?.[idx] && (
          <div style={{ color: "#555", fontSize: 13, marginTop: 4 }}>{ans.texts[idx]}</div>
        )}
      </div>
    );
  }
  return JSON.stringify(ans);
}

function JobBlock({ jobAnswers, jobNum }) {
  return (
    <div>
      {jobNum > 0 && (
        <div style={{
          background: "#EEF3FF", borderRadius: 10, padding: "10px 16px",
          fontSize: 13, fontWeight: 700, color: "#3B7BF6", marginBottom: 16
        }}>
          Место работы #{jobNum + 1}
        </div>
      )}
      {REZULTAT_QUESTIONS.filter((q) => !q.isLast || jobNum === 0).map((q) => {
        if (q.isLast) return null;
        if (jobNum > 0 && q.id < 3) return null; // skip Q1-Q2 for subsequent jobs
        const ans = jobAnswers?.[q.id];
        return (
          <div key={q.id} style={{
            borderBottom: "1px solid #F0F0F0", paddingBottom: 16, marginBottom: 16
          }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Вопрос {q.id}
            </div>
            <div style={{ fontSize: 14, color: "#333", marginBottom: 8, lineHeight: 1.5 }}>
              {q.question}
            </div>
            <div style={{ fontSize: 14, color: "#111", lineHeight: 1.5 }}>
              {getAnswerText(q, ans)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RezultResultCard({ result, onClose }) {
  const [expandedJob, setExpandedJob] = useState(null);
  const { candidate_name, candidate_age, candidate_phone, candidate_city,
    candidate_gender, previous_test, jobs, created_at } = result;

  const date = created_at ? new Date(created_at).toLocaleDateString("ru-RU") : "—";
  const jobsList = jobs || [result.answers || {}];

  return (
    <div style={{ background: "#F5F6FA", minHeight: "100%", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onClose}
          style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#555", padding: "4px 8px" }}>
          ←
        </button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{candidate_name}</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {candidate_age ? `${candidate_age} лет · ` : ""}{date}
          </div>
        </div>
      </div>

      {/* Анкета info */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 16,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)"
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Анкета
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
          {[
            ["Город", candidate_city],
            ["Телефон", candidate_phone],
            ["Пол", candidate_gender],
            ["Ранее проходил", previous_test ? "Да" : "Нет"],
          ].map(([label, val]) => val ? (
            <div key={label}>
              <span style={{ fontSize: 12, color: "#888" }}>{label}: </span>
              <span style={{ fontSize: 14, color: "#111" }}>{val}</span>
            </div>
          ) : null)}
        </div>
      </div>

      {/* Jobs */}
      {jobsList.map((jobAnswers, i) => (
        <div key={i} style={{
          background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 12,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)"
        }}>
          <button
            onClick={() => setExpandedJob(expandedJob === i ? null : i)}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              border: "none", background: "none", cursor: "pointer", padding: 0, marginBottom: expandedJob === i ? 16 : 0
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
              {i === 0 ? "Основное место работы" : `Место работы #${i + 1}`}
              {jobAnswers?.[3]?.text && (
                <span style={{ fontSize: 13, color: "#555", fontWeight: 400, marginLeft: 8 }}>
                  — {jobAnswers[3].text}
                </span>
              )}
            </div>
            <span style={{ fontSize: 18, color: "#888" }}>{expandedJob === i ? "▲" : "▼"}</span>
          </button>

          {expandedJob === i && <JobBlock jobAnswers={jobAnswers} jobNum={i} />}
        </div>
      ))}
    </div>
  );
}
