// Переиспользуемый блок "Анализ кандидата" для всех тестов
export default function AnalysisBlock({ analysis }) {
  if (!analysis) return null;
  const { pros = [], cons = [], verdict } = analysis;
  if (pros.length === 0 && cons.length === 0 && !verdict) return null;
  const interviewChecks = [
    ...cons.slice(0, 2).map((item) => `Попросите пример из прошлого опыта: как проявлялось «${item.toLowerCase()}» и что человек сделал, чтобы это компенсировать.`),
    ...pros.slice(0, 1).map((item) => `Проверьте сильную сторону на фактах: где «${item.toLowerCase()}» уже давало измеримый результат.`),
  ].slice(0, 3);

  return (
    <div style={{ marginTop: 24, borderRadius: 14, border: "1.5px solid #D8D5CF", overflow: "hidden", boxShadow: "0 1px 3px rgba(28,27,26,.07)" }}>
      <div style={{ background: "#1C1B1A", padding: "14px 20px", borderBottom: "1px solid #1C1B1A" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Анализ для руководителя</span>
      </div>

      <div style={{ padding: "16px 20px", background: "#fff" }}>
        {/* Вывод */}
        {verdict && (
          <div style={{ background: "#F1EFEA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#333", lineHeight: 1.6, borderLeft: "4px solid #1C1B1A" }}>
            {verdict}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: pros.length && cons.length ? "repeat(auto-fit, minmax(220px,1fr))" : "1fr", gap: 16 }}>
          {/* Плюсы */}
          {pros.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#2e7d32", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                Сильные стороны
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
                Риски и подводные камни
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

        {interviewChecks.length > 0 && (
          <div style={{ marginTop: 18, background: "#FBF1E2", border: "1px solid #E8C97A", borderRadius: 12, padding: "13px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#8A5A14", marginBottom: 8 }}>
              Что проверить на интервью
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {interviewChecks.map((q, i) => (
                <li key={i} style={{ fontSize: 13, color: "#44413B", lineHeight: 1.55, marginBottom: 6 }}>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
