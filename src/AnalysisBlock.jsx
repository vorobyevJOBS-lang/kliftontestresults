// Переиспользуемый блок "Анализ кандидата" для всех тестов
export default function AnalysisBlock({ analysis }) {
  if (!analysis) return null;
  const { pros = [], cons = [], verdict } = analysis;
  if (pros.length === 0 && cons.length === 0 && !verdict) return null;

  return (
    <div style={{ marginTop: 24, borderRadius: 16, border: "1.5px solid #e0e0e0", overflow: "hidden" }}>
      <div style={{ background: "#f8f9fa", padding: "14px 20px", borderBottom: "1px solid #e0e0e0" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#333" }}>💡 Анализ кандидата</span>
      </div>

      <div style={{ padding: "16px 20px", background: "#fff" }}>
        {/* Вывод */}
        {verdict && (
          <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#333", lineHeight: 1.6, borderLeft: "4px solid #3B7BF6" }}>
            {verdict}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: pros.length && cons.length ? "1fr 1fr" : "1fr", gap: 16 }}>
          {/* Плюсы */}
          {pros.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#2e7d32", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>✅</span> Сильные стороны
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 4px", listStyle: "none" }}>
                {pros.map((p, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#333", lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#4caf50" }}>•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Минусы */}
          {cons.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#c62828", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>⚠️</span> Риски и слабые стороны
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 4px", listStyle: "none" }}>
                {cons.map((c, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#333", lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#f44336" }}>•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
