import { useState } from "react";
import { PRIM_FACTORS, getPrimLevel, PRIM_LEVEL_STYLE, PRIM_DESCRIPTIONS, JOB_PROFILES, calcJobMatch, PRIM_SCALE_TO_NAME } from "./primMeta";

const S = {
  display: { fontFamily: "'Unbounded', 'Golos Text', sans-serif" },
  card: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(28,27,26,.07)", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8A867E" },
};

function ScoreBar({ score, color }) {
  const pct = Math.round((score + 100) / 2); // -100..+100 → 0..100%
  return (
    <div style={{ height: 8, background: "#F1EFEA", borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width .4s ease" }} />
    </div>
  );
}

function FactorRow({ factor, score, expanded, onToggle }) {
  const level = getPrimLevel(score);
  const ls = PRIM_LEVEL_STYLE[level];
  const desc = PRIM_DESCRIPTIONS[factor.name]?.[level] || "";
  const isStrong = score >= 25;
  const isWeak = score <= -25;
  const borderColor = isStrong ? "#16A34A" : isWeak ? "#DC2626" : "#E5E3DE";

  return (
    <div style={{ border: `2px solid ${borderColor}`, borderRadius: 14, padding: "14px 16px", marginBottom: 8, background: isStrong ? "#F0FDF4" : isWeak ? "#FFF1F0" : "#fff", cursor: "pointer" }}
      onClick={onToggle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{factor.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{factor.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: ls.color, background: ls.bg, padding: "2px 8px", borderRadius: 99 }}>{level}</span>
            {isStrong && <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 700 }}>✓ Сильная сторона</span>}
            {isWeak && <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 700 }}>⚠ Зона риска</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScoreBar score={score} color={factor.color} />
            <span style={{ fontSize: 13, fontWeight: 700, color: factor.color, minWidth: 38, textAlign: "right" }}>
              {score > 0 ? `+${score}` : score}
            </span>
          </div>
        </div>
        <span style={{ color: "#8A867E", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && desc && (
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "#44413B", lineHeight: 1.6, paddingLeft: 30 }}>{desc}</p>
      )}
    </div>
  );
}

function JobProfileBlock({ scores }) {
  return (
    <div style={S.card}>
      <div style={{ ...S.display, fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 Соответствие профилям должностей</div>
      {JOB_PROFILES.map(profile => {
        const match = calcJobMatch(scores, profile);
        const matchColor = match >= 80 ? "#16A34A" : match >= 60 ? "#2563EB" : match >= 40 ? "#D97706" : "#DC2626";
        const matchBg = match >= 80 ? "#DCFCE7" : match >= 60 ? "#DBEAFE" : match >= 40 ? "#FEF3C7" : "#FEE2E2";

        return (
          <div key={profile.id} style={{ border: "1.5px solid #E5E3DE", borderRadius: 12, padding: "14px 16px", marginBottom: 10, background: match >= 80 ? "#F0FDF4" : "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{profile.name}</div>
                <div style={{ fontSize: 12, color: "#8A867E" }}>{profile.description}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 56 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: matchColor }}>{match}%</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: matchColor, background: matchBg, borderRadius: 99, padding: "1px 6px" }}>
                  {match >= 80 ? "Подходит" : match >= 60 ? "Вероятно" : match >= 40 ? "Частично" : "Не подходит"}
                </div>
              </div>
            </div>
            {/* Требования по факторам */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(profile.requirements).map(([factorId, threshold]) => {
                const factorName = PRIM_SCALE_TO_NAME[factorId];
                const factorMeta = PRIM_FACTORS.find(f => f.id === factorId);
                const score = scores[factorName] ?? 0;
                const met = score >= threshold;
                return (
                  <span key={factorId} style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                    background: met ? "#DCFCE7" : "#FEE2E2",
                    color: met ? "#15803D" : "#B91C1C",
                    border: `1px solid ${met ? "#BBF7D0" : "#FECACA"}`,
                  }}>
                    {met ? "✓" : "✗"} {factorMeta?.icon} {factorName} ({score > 0 ? `+${score}` : score} / нужно {threshold > 0 ? `+${threshold}` : threshold})
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PrimResultCard({ result }) {
  const [expandedFactor, setExpandedFactor] = useState(null);
  const [showJobProfiles, setShowJobProfiles] = useState(true);

  if (!result?.scores) return null;
  const scores = result.scores;

  const sorted = [...PRIM_FACTORS].sort((a, b) => (scores[b.name] ?? 0) - (scores[a.name] ?? 0));
  const strengths = sorted.filter(f => (scores[f.name] ?? 0) >= 25);
  const risks = sorted.filter(f => (scores[f.name] ?? 0) <= -25);

  const totalAnswered = result.answers_count ?? 0;
  const maybeCount = result.maybe_count ?? 0;
  const timeMin = result.time_spent ? Math.round(result.time_spent / 60) : null;

  return (
    <div>
      {/* Сводка */}
      <div style={{ ...S.card, background: "#1C1B1A", color: "#fff" }}>
        <div style={{ ...S.display, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{result.candidate_name}</div>
        <div style={{ fontSize: 13, color: "#9B978F", marginBottom: 14 }}>
          {result.candidate_age ? `${result.candidate_age} лет · ` : ""}Первичный анализ
          {timeMin ? ` · ${timeMin} мин` : ""}
          {totalAnswered ? ` · ${totalAnswered} ответов` : ""}
          {maybeCount ? ` · «Может быть»: ${maybeCount}` : ""}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {strengths.length > 0 && (
            <div style={{ background: "#16A34A22", border: "1px solid #16A34A44", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#86EFAC" }}>
              ✓ Сильные стороны: {strengths.map(f => f.name).join(", ")}
            </div>
          )}
          {risks.length > 0 && (
            <div style={{ background: "#DC262622", border: "1px solid #DC262644", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#FCA5A5" }}>
              ⚠ Зоны риска: {risks.map(f => f.name).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Профили должностей */}
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setShowJobProfiles(v => !v)}
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6457D6", padding: "4px 0", marginBottom: 8 }}
        >
          {showJobProfiles ? "▼" : "▶"} Соответствие должностям
        </button>
        {showJobProfiles && <JobProfileBlock scores={scores} />}
      </div>

      {/* Все 8 факторов */}
      <div style={{ ...S.label, marginBottom: 10 }}>Профиль по 8 факторам</div>
      {sorted.map(factor => (
        <FactorRow
          key={factor.id}
          factor={factor}
          score={scores[factor.name] ?? 0}
          expanded={expandedFactor === factor.id}
          onToggle={() => setExpandedFactor(expandedFactor === factor.id ? null : factor.id)}
        />
      ))}
    </div>
  );
}
