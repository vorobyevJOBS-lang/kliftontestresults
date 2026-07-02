const displayFont = "'Unbounded', 'Golos Text', sans-serif";

export const startInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 15px",
  fontSize: 16,
  borderRadius: 12,
  border: "1.5px solid #D8D5CF",
  fontFamily: "inherit",
  outline: "none",
  background: "#fff",
  color: "#1C1B1A",
};

export const startLabelStyle = {
  fontSize: 14,
  fontWeight: 700,
  display: "block",
  marginBottom: 8,
  color: "#1C1B1A",
};

export function StartNote({ children }) {
  return (
    <div style={{
      marginTop: 18,
      background: "#F6F5F2",
      border: "1px solid #EEECE7",
      borderRadius: 12,
      padding: "12px 14px",
      fontSize: 13,
      color: "#6B675F",
      lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
}

export function StartButton({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        border: "none",
        borderRadius: 12,
        padding: "16px",
        marginTop: 20,
        fontSize: 16,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        background: disabled ? "#B9B6AF" : "#1C1B1A",
        color: "#fff",
        boxShadow: disabled ? "none" : "0 10px 22px rgba(28,27,26,.16)",
        transition: "transform .16s ease, box-shadow .16s ease, background .16s ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 14px 26px rgba(28,27,26,.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = disabled ? "none" : "0 10px 22px rgba(28,27,26,.16)";
      }}
    >
      {children}
    </button>
  );
}

export default function TestStartLayout({
  icon,
  eyebrow,
  title,
  description,
  meta,
  onBack,
  children,
  accent = "#1C1B1A",
}) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F6F5F2",
      color: "#1C1B1A",
      fontFamily: "'Golos Text', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        <button
          onClick={onBack}
          style={{
            border: "1.5px solid #D8D5CF",
            background: "rgba(255,255,255,.72)",
            color: "#44413B",
            borderRadius: 12,
            padding: "9px 14px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 18,
          }}
        >
          ← Главная
        </button>

        <div style={{
          background: "#fff",
          borderRadius: 18,
          padding: "28px 28px 30px",
          boxShadow: "0 14px 38px rgba(28,27,26,.08)",
          border: "1px solid #EEECE7",
        }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: `${accent}17`,
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              flex: "0 0 auto",
            }}>
              {icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: displayFont,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: accent,
                marginBottom: 8,
              }}>
                {eyebrow}
              </div>
              <h1 style={{
                fontFamily: displayFont,
                fontSize: 28,
                lineHeight: 1.18,
                fontWeight: 800,
                margin: "0 0 10px",
              }}>
                {title}
              </h1>
              <p style={{ margin: 0, color: "#6B675F", fontSize: 15, lineHeight: 1.6 }}>
                {description}
              </p>
            </div>
          </div>

          {meta && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
              marginBottom: 22,
            }}>
              {meta.map((item) => (
                <div key={item.label} style={{
                  background: "#F8F7F4",
                  border: "1px solid #EEECE7",
                  borderRadius: 12,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: "#8A867E", marginTop: 3 }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
