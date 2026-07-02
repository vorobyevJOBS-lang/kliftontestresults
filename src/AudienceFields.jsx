import { APPLICANT_TYPES, BRANCHES } from "./org";

export default function AudienceFields({
  branchId,
  setBranchId,
  applicantType,
  setApplicantType,
  dark = false,
}) {
  const labelColor = dark ? "rgba(255,255,255,0.74)" : "#1C1B1A";
  const fieldBg = dark ? "rgba(255,255,255,0.1)" : "#fff";
  const fieldBorder = dark ? "1px solid rgba(255,255,255,0.2)" : "1.5px solid #D8D5CF";
  const mutedBg = dark ? "rgba(255,255,255,0.08)" : "#F1EFEA";
  const activeBg = dark ? "linear-gradient(135deg, #e040fb, #9c27b0)" : "#1C1B1A";

  return (
    <>
      <label style={{ fontSize: 14, fontWeight: 600, display: "block", margin: "18px 0 8px", color: labelColor }}>
        Филиал
      </label>
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "13px 14px",
          fontSize: 16,
          borderRadius: 12,
          border: fieldBorder,
          fontFamily: "inherit",
          outline: "none",
          background: fieldBg,
          color: dark ? "#fff" : "#1C1B1A",
        }}
      >
        {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label style={{ fontSize: 14, fontWeight: 600, display: "block", margin: "18px 0 8px", color: labelColor }}>
        Кто проходит тест
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {APPLICANT_TYPES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setApplicantType(id)}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "13px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flex: "1 1 180px",
              background: applicantType === id ? activeBg : mutedBg,
              color: applicantType === id ? "#fff" : dark ? "rgba(255,255,255,0.78)" : "#1C1B1A",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
