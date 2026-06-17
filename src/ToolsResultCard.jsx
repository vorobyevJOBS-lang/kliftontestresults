import { useState } from "react";
import { TOOLS_INDICATORS, TOOLS_DESCRIPTIONS, LEVEL_STYLE, getToolsLevel, scoreToPercent } from "./toolsMeta";
import { toolsAnalysis } from "./analysisUtils";
import AnalysisBlock from "./AnalysisBlock";

// Горизонтальная шкала -100..+100 с маркером
function ScaleBar({ score, color }) {
  const pct = scoreToPercent(score); // 0..100
  const level = getToolsLevel(score);
  const ls = LEVEL_STYLE[level];
  return (
    <div style={{ position: "relative", height: 10, background: "#EEECE7", borderRadius: 99, margin: "6px 0 2px" }}>
      {/* Центральная черта */}
      <div style={{ position: "absolute", left: "50%", top: 0, width: 1.5, height: "100%", background: "#D0CCC5" }} />
      {/* Заполнение от центра */}
      {score >= 0 ? (
        <div style={{
          position: "absolute", left: "50%", top: 0,
          width: `${(pct - 50)}%`, height: "100%",
          background: color, borderRadius: "0 99px 99px 0",
          transition: "width .5s ease",
        }} />
      ) : (
        <div style={{
          position: "absolute", left: `${pct}%`, top: 0,
          width: `${50 - pct}%`, height: "100%",
          background: color, borderRadius: "99px 0 0 99px",
          transition: "width .5s ease",
        }} />
      )}
      {/* Маркер */}
      <div style={{
        position: "absolute", left: `${pct}%`, top: "50%",
        transform: "translate(-50%,-50%)",
        width: 14, height: 14, borderRadius: "50%",
        background: color, border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        transition: "left .5s ease",
      }} />
    </div>
  );
}

// Одна строка индикатора
function IndicatorRow({ ind, score, expanded, onToggle }) {
  const level = getToolsLevel(score);
  const ls = LEVEL_STYLE[level];
  const desc = TOOLS_DESCRIPTIONS[ind.name]?.[level] || "";

  return (
    <div
      onClick={onToggle}
      style={{
        padding: "14px 16px", borderRadius: 12, cursor: "pointer",
        background: expanded ? ind.soft : "transparent",
        border: `1.5px solid ${expanded ? ind.color + "50" : "transparent"}`,
        transition: "background .2s, border .2s",
        marginBottom: 6,
      }}
    >
      {/* Заголовок строки */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1C1B1A" }}>{ind.name}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
            color: ls.color, background: ls.bg, padding: "2px 8px", borderRadius: 99,
          }}>{level}</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: ind.color, minWidth: 36, textAlign: "right" }}>
          {score > 0 ? `+${score}` : score}
        </span>
      </div>

      {/* Полярные подписи */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8A867E", marginBottom: 2 }}>
        <span>{ind.low}</span>
        <span>{ind.high}</span>
      </div>

      {/* Шкала */}
      <ScaleBar score={score} color={ind.color} />

      {/* Описание (раскрывается) */}
      {expanded && desc && (
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "#44413B", lineHeight: 1.6 }}>{desc}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Главный компонент карточки результата Тулс
// Props:
//   rec — объект из Supabase tools_results или распарсенный PDF
// ─────────────────────────────────────────────────────────────
export default function ToolsResultCard({ rec }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!rec) return null;
  const scores = rec.scores || {};
  const syndromes = rec.syndromes || [];
  const answersCount = rec.answers_count ?? rec.answersCount ?? "?";
  const totalQ = rec.total_questions ?? 200;
  const completionPct = answersCount !== "?" ? Math.round((answersCount / totalQ) * 100) : null;

  // Средний балл
  const vals = TOOLS_INDICATORS.map(ind => scores[ind.name] ?? 0);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

  return (
    <div>
      {/* Шапка */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Unbounded','Golos Text',sans-serif" }}>
          {rec.candidate_name || rec.name}
        </div>
        {rec.candidate_age && (
          <div style={{ color: "#8A867E", fontSize: 14, marginTop: 2 }}>{rec.candidate_age} лет</div>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          {completionPct !== null && (
            <span style={{ fontSize: 13, color: completionPct < 50 ? "#E25C44" : "#6B675F" }}>
              Ответов: {answersCount} из {totalQ}
              {completionPct < 50 && " ⚠ неполный"}
            </span>
          )}
          {rec.created_at && (
            <span style={{ fontSize: 13, color: "#8A867E" }}>
              {new Date(rec.created_at).toLocaleDateString("ru-RU")}
            </span>
          )}
          <span style={{ fontSize: 13, color: "#8A867E" }}>
            Средний балл: <b style={{ color: "#1C1B1A" }}>{avg > 0 ? `+${avg}` : avg}</b>
          </span>
        </div>
      </div>

      {/* Шкала уровней (легенда) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["Очень низкий","Низкий","Средний","Высокий","Очень высокий"].map(lv => {
          const ls = LEVEL_STYLE[lv];
          return (
            <span key={lv} style={{ fontSize: 11, fontWeight: 600, color: ls.color, background: ls.bg, padding: "3px 8px", borderRadius: 99 }}>
              {lv}
            </span>
          );
        })}
      </div>

      {/* 10 индикаторов */}
      {TOOLS_INDICATORS.map(ind => (
        <IndicatorRow
          key={ind.id}
          ind={ind}
          score={scores[ind.name] ?? 0}
          expanded={expandedId === ind.id}
          onToggle={() => setExpandedId(expandedId === ind.id ? null : ind.id)}
        />
      ))}

      {/* Синдромы */}
      {syndromes.length > 0 && (
        <div style={{ marginTop: 20, background: "#F6F5F2", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase", color: "#8A867E", marginBottom: 10 }}>
            Синдромы и перевесы
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {syndromes.map((s, i) => (
              <span key={i} style={{ fontSize: 13, fontWeight: 600, background: "#fff", border: "1.5px solid #D8D5CF", borderRadius: 10, padding: "5px 12px", color: "#1C1B1A" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Анализ кандидата */}
      <AnalysisBlock analysis={toolsAnalysis(scores)} />
    </div>
  );
}
