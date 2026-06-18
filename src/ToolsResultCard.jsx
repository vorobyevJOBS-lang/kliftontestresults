import { TOOLS_INDICATORS, TOOLS_DESCRIPTIONS, LEVEL_STYLE, getToolsLevel } from "./toolsMeta";
import { detectToolsSyndromes } from "./analysisUtils";

// ─── Bar chart colors matching original HRScanner ───────────────────────────
const CHART_COLORS = {
  A: "#4A90D9", B: "#4A90D9", C: "#4A90D9",
  D: "#29CAD9",
  E: "#F5A623", F: "#F5A623", G: "#F5A623",
  H: "#5CB85C", I: "#5CB85C", J: "#5CB85C",
};

// Feminine level names (all indicators are feminine nouns ending in -ость)
const LEVEL_FEM = {
  "Очень низкий": "Очень низкая",
  "Низкий":       "Низкая",
  "Средний":      "Средняя",
  "Высокий":      "Высокая",
  "Очень высокий":"Очень высокая",
};

function formatTime(totalSec) {
  if (totalSec == null) return "—";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// Zone label sections and divider positions (% of bar area width)
const ZONE_SECTIONS = [
  { label: "Очень низкий", from: 0,  to: 16 },
  { label: "Низкий",       from: 16, to: 34 },
  { label: "Средний",      from: 34, to: 66 },
  { label: "Высокий",      from: 66, to: 84 },
  { label: "Очень высокий",from: 84, to: 100 },
];
const ZONE_DIVIDERS = [16, 34, 66, 84];
const AXIS_VALS = [-100, -68, -32, 32, 68, 100];

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({ scores }) {
  const LEFT_PX = 186;
  const SCORE_PX = 60;

  return (
    <div style={{
      background: "#F8F7F4", borderRadius: 12,
      padding: "14px 16px 10px",
      marginBottom: 24,
    }}>
      {/* Zone header */}
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ width: LEFT_PX + SCORE_PX, flexShrink: 0 }} />
        <div style={{ flex: 1, position: "relative", height: 20 }}>
          {ZONE_SECTIONS.map((z, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${z.from}%`,
              width: `${z.to - z.from}%`,
              textAlign: "center",
              fontSize: 11,
              color: "#9A9690",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}>
              {z.label}
            </div>
          ))}
        </div>
      </div>

      {/* Indicator rows */}
      {TOOLS_INDICATORS.map(ind => {
        const score = scores[ind.id] ?? scores[ind.name] ?? 0;
        const barPct = ((score + 100) / 200) * 100;
        const color = CHART_COLORS[ind.id];
        const isExtreme = Math.abs(score) >= 68;

        return (
          <div key={ind.id} style={{ display: "flex", alignItems: "center", minHeight: 42 }}>
            {/* Indicator name + polarity */}
            <div style={{ width: LEFT_PX, flexShrink: 0, paddingRight: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "#1C1B1A", lineHeight: 1.25 }}>
                {ind.id}. {ind.name}
              </div>
              <div style={{ fontSize: 11, color: "#AAA49C", lineHeight: 1.2 }}>
                {ind.low} — {ind.high}
              </div>
            </div>

            {/* Score */}
            <div style={{
              width: SCORE_PX, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingRight: 10, gap: 2,
              fontSize: 18, fontWeight: 700, color: "#1C1B1A",
            }}>
              {isExtreme && <span style={{ color: "#F5A623", fontSize: 13 }}>⚡</span>}
              <span>{score}</span>
            </div>

            {/* Bar */}
            <div style={{ flex: 1, position: "relative", height: 26 }}>
              {/* Dashed zone dividers */}
              {ZONE_DIVIDERS.map(pct => (
                <div key={pct} style={{
                  position: "absolute",
                  left: `${pct}%`, top: 0, bottom: 0,
                  borderLeft: "1.5px dashed #D8D4CC",
                  pointerEvents: "none",
                }} />
              ))}
              {/* Bar fills from left edge to score position */}
              <div style={{
                position: "absolute",
                left: 0, top: "50%", transform: "translateY(-50%)",
                width: `${barPct}%`,
                height: 22,
                background: color,
                borderRadius: "0 4px 4px 0",
              }} />
            </div>
          </div>
        );
      })}

      {/* X-axis labels */}
      <div style={{ display: "flex", marginTop: 6 }}>
        <div style={{ width: LEFT_PX + SCORE_PX, flexShrink: 0 }} />
        <div style={{ flex: 1, position: "relative", height: 16 }}>
          {AXIS_VALS.map(val => {
            const pct = ((val + 100) / 200) * 100;
            return (
              <span key={val} style={{
                position: "absolute",
                left: `${pct}%`,
                transform: "translateX(-50%)",
                fontSize: 10,
                color: "#9A9690",
              }}>
                {val}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Row ───────────────────────────────────────────────────────────────
function StatsRow({ maybeCount, totalQ, timeSpent }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 32 }}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 14,
        background: "#F8F7F4", borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: "#EBE6FB",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>💬</div>
        <div>
          <div style={{ fontSize: 12, color: "#8A867E", lineHeight: 1.3 }}>Ответы</div>
          <div style={{ fontSize: 12, color: "#8A867E", lineHeight: 1.3 }}>«Может быть»</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1C1B1A", lineHeight: 1.15 }}>
            {maybeCount != null ? `${maybeCount} из ${totalQ}` : `— из ${totalQ}`}
          </div>
        </div>
      </div>

      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 14,
        background: "#F8F7F4", borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: "#FDE8E3",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>⏱</div>
        <div>
          <div style={{ fontSize: 12, color: "#8A867E", lineHeight: 1.3 }}>Время</div>
          <div style={{ fontSize: 12, color: "#8A867E", lineHeight: 1.3 }}>выполнения</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1C1B1A", lineHeight: 1.15 }}>
            {formatTime(timeSpent)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Syndromes Section ───────────────────────────────────────────────────────
function SyndromesSection({ scores }) {
  const syndromes = detectToolsSyndromes(scores);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1B1A", marginBottom: 16 }}>
        Синдромы и перевесы
      </div>

      {(!syndromes || syndromes.length === 0) ? (
        <div style={{
          background: "#F8F7F4", borderRadius: 12, padding: "16px 18px",
          fontSize: 14, color: "#6B675F",
        }}>
          Явно выраженных синдромов не выявлено.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          background: "#F8F7F4",
          borderRadius: 12,
          padding: 14,
        }}>
          {syndromes.map((synd, i) => (
            <div key={i} style={{
              background: "#FFFFFF",
              borderRadius: 10,
              padding: "14px 16px",
              border: "1px solid #EDEAE5",
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1B1A", marginBottom: 8 }}>
                {synd.name}
              </div>
              <div style={{ fontSize: 13, color: "#44413B", lineHeight: 1.5 }}>
                {synd.desc}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Descriptions Section ────────────────────────────────────────────────────
function DescriptionsSection({ scores }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1B1A", marginBottom: 16 }}>
        Объяснение результатов
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {TOOLS_INDICATORS.map(ind => {
          const score = scores[ind.id] ?? scores[ind.name] ?? 0;
          const level = getToolsLevel(score);
          const ls = LEVEL_STYLE[level];
          const desc = TOOLS_DESCRIPTIONS[ind.name]?.[level] || "";

          return (
            <div key={ind.id} style={{
              background: "#F8F7F4",
              borderRadius: 12,
              padding: "14px 16px",
              border: "1px solid #EDEAE5",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", gap: 8, marginBottom: 10,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1B1A", lineHeight: 1.3 }}>
                  {ind.id}. {ind.name}
                </div>
                <span style={{
                  fontSize: 11.5, fontWeight: 600, flexShrink: 0,
                  color: ls.color, background: ls.bg,
                  padding: "3px 9px", borderRadius: 99,
                }}>
                  {LEVEL_FEM[level]}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "#44413B", lineHeight: 1.55 }}>
                {desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function ToolsResultCard({ rec }) {
  if (!rec) return null;
  const scores = rec.scores || {};
  const maybeCount = rec.maybe_count ?? rec.maybeCount ?? null;
  const totalQ = rec.total_questions ?? 200;
  const timeSpent = rec.time_spent ?? null;

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 24, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 20, fontWeight: 700, color: "#1C1B1A", lineHeight: 1.3,
          fontFamily: "'Unbounded','Golos Text',sans-serif",
        }}>
          Результаты тестирования «Тулс» — {rec.candidate_name || rec.name}
        </div>
        {rec.candidate_age && (
          <div style={{
            fontSize: 13, color: "#6B675F",
            border: "1.5px solid #D0CCC5",
            borderRadius: 99, padding: "3px 10px", flexShrink: 0,
          }}>
            {rec.candidate_age} лет
          </div>
        )}
      </div>

      <BarChart scores={scores} />
      <StatsRow maybeCount={maybeCount} totalQ={totalQ} timeSpent={timeSpent} />
      <SyndromesSection scores={scores} />
      <DescriptionsSection scores={scores} />
    </div>
  );
}
