import { useState, useRef } from "react";
import { supabase } from "./supabase";
import { S, Bar, DomainTag, DOMAINS, TALENT_META, TALENTS, POSITIONS, BRANCHES, branchById } from "./App";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ToolsResultCard from "./ToolsResultCard";
import { SAILS_SCALE_NAMES, SAILS_SCALE_DESC, sailsLevel } from "./sailsQuestions";
import { logisAnalysis, sailsAnalysis } from "./analysisUtils";
import AnalysisBlock from "./AnalysisBlock";
import RezultResultCard from "./RezultResultCard";
import PrimResultCard from "./PrimResultCard";
import { getCandidateKey } from "./candidateIdentity";
import { getRouteProgress, TEST_ROUTE_META } from "./testRoutes";

const ADMIN_RESPONSIVE_CSS = `
  [data-admin-report], [data-pdf-card] {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
  }
  [data-admin-report] *, [data-pdf-card] * {
    box-sizing: border-box;
    max-width: 100%;
  }
  body.pdf-exporting [data-pdf-actions] {
    display: none !important;
  }
  body.pdf-exporting [data-admin-report],
  body.pdf-exporting [data-pdf-card] {
    overflow: visible !important;
    background: #F6F5F2 !important;
  }
  @media (max-width: 640px) {
    [data-admin-report],
    [data-pdf-card] {
      overflow-x: hidden !important;
    }
    [data-admin-report] [style*="grid-template-columns: 1fr 1fr"],
    [data-admin-report] [style*="grid-template-columns: repeat(2"],
    [data-pdf-card] [style*="grid-template-columns: 1fr 1fr"],
    [data-pdf-card] [style*="grid-template-columns: repeat(2"] {
      grid-template-columns: 1fr !important;
    }
    [data-admin-report] [style*="min-width"],
    [data-pdf-card] [style*="min-width"] {
      min-width: 0 !important;
    }
    [data-admin-report] [style*="display: flex"],
    [data-pdf-card] [style*="display: flex"] {
      flex-wrap: wrap !important;
    }
  }
`;

const TEST_META = {
  clifton: { label: "Клифтон", icon: "🏆", bg: "#FBF1E2", color: "#D98E2B" },
  tools: { label: "Профиль", icon: "🎯", bg: "#E4F4F0", color: "#0F766E" },
  rezultat: { label: "Опыт", icon: "📊", bg: "#EEF3FF", color: "#2563EB" },
  logis: { label: "Логика", icon: "🧠", bg: "#EEF2FF", color: "#6C63FF" },
  sails: { label: "Продажник", icon: "💎", bg: "#F3E5F5", color: "#9C27B0" },
  prim: { label: "Анализ", icon: "🧭", bg: "#F1EAFF", color: "#7C3AED" },
};

const STATUS_OPTIONS = [
  ["new", "Новый", "#6B7280"],
  ["testing", "Проходит тесты", "#7C3AED"],
  ["review", "На проверке", "#D98E2B"],
  ["interview", "Интервью", "#2563EB"],
  ["offer", "Оффер", "#0F766E"],
  ["hired", "Принят", "#2E9E87"],
  ["rejected", "Отказ", "#E25C44"],
];

const STATUS_META = Object.fromEntries(STATUS_OPTIONS.map(([id, label, color]) => [id, { label, color }]));

async function sha256(text) {
  if (!window.crypto?.subtle) return "";
  const bytes = new TextEncoder().encode(text);
  const hash = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function personName(item) {
  return item.candidate_name || item.name || "Без имени";
}

function resultDate(item) {
  return item.created_at || item.completed_at || item.date || null;
}

export default function Admin() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myBranchId, setMyBranchId] = useState(null); // филиал текущего аккаунта (null для суперадмина)
  const [branchFilter, setBranchFilter] = useState("all"); // для суперадмина: "all" или id филиала
  const [typeTab, setTypeTab] = useState("employee"); // employee | candidate
  const [loginError, setLoginError] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null); // выбранная запись для подробного просмотра
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("archive"); // archive | branches (управление филиалами для суперадмина)
  const [admins, setAdmins] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState(new Set());
  const [testTab, setTestTab] = useState("people"); // people | clifton | tools | rezultat | logis | sails | prim
  const [toolsResults, setToolsResults] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [openTools, setOpenTools] = useState(null); // выбранная запись Профиль
  const [rezultatResults, setRezultatResults] = useState([]);
  const [rezultatLoading, setRezultatLoading] = useState(false);
  const [openRezultat, setOpenRezultat] = useState(null);
  const [logisResults, setLogisResults] = useState([]);
  const [logisLoading, setLogisLoading] = useState(false);
  const [openLogis, setOpenLogis] = useState(null);
  const [sailsResults, setSailsResults] = useState([]);
  const [sailsLoading, setSailsLoading] = useState(false);
  const [primResults, setPrimResults] = useState([]);
  const [primLoading, setPrimLoading] = useState(false);
  const [openPrim, setOpenPrim] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState("");
  const [openPersonKey, setOpenPersonKey] = useState(null);
  const [crmStatusFilter, setCrmStatusFilter] = useState("all");
  const [candidateProfiles, setCandidateProfiles] = useState({});
  const [profilesSaving, setProfilesSaving] = useState({});
  const reportRef = useRef(null);

  const withLoadTimeout = (promise, label) =>
    Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve({
        data: null,
        error: { message: `${label}: превышено время загрузки. Проверьте интернет/VPN или доступность Supabase.` },
      }), 12000)),
    ]);

  const noteLoadError = (label, error) => {
    if (!error) return;
    console.error(label, error);
    setLoadError("Не удалось загрузить часть результатов. Если без VPN висит загрузка, вероятно провайдер блокирует доступ к Supabase; включите VPN или попробуйте другую сеть.");
  };

  const loadCandidateProfiles = async () => {
    const { data, error } = await withLoadTimeout(
      supabase.from("candidate_profiles").select("*"),
      "candidate_profiles"
    );
    if (error) {
      console.warn("candidate_profiles", error);
      return;
    }
    setCandidateProfiles(Object.fromEntries((data || []).map((profile) => [profile.candidate_key, profile])));
  };

  const saveCandidateProfile = async (person, patch) => {
    const current = candidateProfiles[person.key] || {};
    const next = {
      ...current,
      ...patch,
      candidate_key: person.key,
      candidate_name: current.candidate_name || person.name,
      candidate_email: current.candidate_email || person.email || null,
      candidate_phone: current.candidate_phone || person.phone || null,
      branch_id: current.branch_id || person.branchId || null,
      updated_at: new Date().toISOString(),
    };

    setCandidateProfiles((prev) => ({ ...prev, [person.key]: next }));
    setProfilesSaving((prev) => ({ ...prev, [person.key]: true }));
    const optionalFields = ["target_position_id", "target_position_name", "hired_feedback", "hired_feedback_date"];
    let currentRecord = { ...next };
    let response = await supabase.from("candidate_profiles").upsert(currentRecord, { onConflict: "candidate_key" });
    while (response.error) {
      const message = `${response.error.message || ""} ${response.error.details || ""}`.toLowerCase();
      const missingField = optionalFields.find((field) => Object.prototype.hasOwnProperty.call(currentRecord, field) && message.includes(field));
      if (!missingField) break;
      delete currentRecord[missingField];
      response = await supabase.from("candidate_profiles").upsert(currentRecord, { onConflict: "candidate_key" });
    }
    setProfilesSaving((prev) => ({ ...prev, [person.key]: false }));
    const { error } = response;
    if (error) {
      console.error("candidate_profiles upsert", error);
      window.alert("Не удалось сохранить статус/комментарий. Проверьте, что SQL для candidate_profiles выполнен в Supabase.");
    }
  };

  const handleLogin = async () => {
    const cleanLogin = login.trim();
    const cleanPassword = password.trim();
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .eq("login", cleanLogin)
      .maybeSingle();

    if (error) console.error("admins login", error);
    const cleanPasswordHash = await sha256(cleanPassword);
    const passwordOk = data && (
      data.password_hash === cleanPasswordHash ||
      data.password === cleanPassword
    );

    if (passwordOk) {
      setLoginError(false);
      setAuthorized(true);
      setLoadError("");
      const superAdmin = data.login === "vvvorobyev1991";
      setIsSuperAdmin(superAdmin);
      setMyBranchId(superAdmin ? null : data.branch_id || null);
      loadResults();
      loadToolsResults();
      loadRezultatResults();
      loadLogisResults();
      loadSailsResults();
      loadPrimResults();
      loadCandidateProfiles();
    } else {
      setLoginError(true);
    }
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      const { data, error } = await withLoadTimeout(
        supabase.from("results").select("*").order("created_at", { ascending: false }).limit(200),
        "results"
      );
      noteLoadError("results", error);
      if (data) setResults(data);
    } finally {
      setLoading(false);
    }
  };

  function copyReport(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) { console.error(e); }
  }

  async function downloadPdf(candidateName, sourceNode = reportRef.current) {
    if (!sourceNode || pdfLoading) return;
    setPdfLoading(true);
    setPdfMode(true);
    try {
      document.body.classList.add("pdf-exporting");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const canvas = await html2canvas(sourceNode, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#F6F5F2",
        windowWidth: Math.max(sourceNode.scrollWidth, 794),
        scrollX: 0,
        scrollY: 0,
      });

      const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const renderScale = printableWidth / canvas.width;
      const sourcePageHeight = Math.floor(printableHeight / renderScale);

      let sourceY = 0;
      let pageIndex = 0;
      while (sourceY < canvas.height) {
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          margin,
          margin,
          printableWidth,
          sliceHeight * renderScale
        );
        sourceY += sliceHeight;
        pageIndex += 1;
      }

      const safeName = (candidateName || "report").replace(/[^\p{L}\p{N}_-]+/gu, "_");
      pdf.save(`${safeName}_отчёт.pdf`);
    } catch (e) {
      console.error(e);
      window.alert("Не удалось сформировать PDF. Попробуйте ещё раз.");
    } finally {
      document.body.classList.remove("pdf-exporting");
      setPdfMode(false);
      setPdfLoading(false);
    }
  }

  const loadToolsResults = async () => {
    setToolsLoading(true);
    try {
      const { data, error } = await withLoadTimeout(
        supabase.from("tools_results").select("*").order("created_at", { ascending: false }).limit(200),
        "tools_results"
      );
      noteLoadError("tools_results", error);
      if (data) setToolsResults(data);
    } finally {
      setToolsLoading(false);
    }
  };

  const loadRezultatResults = async () => {
    setRezultatLoading(true);
    try {
      const { data, error } = await withLoadTimeout(
        supabase.from("rezultat_results").select("*").order("created_at", { ascending: false }).limit(200),
        "rezultat_results"
      );
      noteLoadError("rezultat_results", error);
      if (data) setRezultatResults(data);
    } finally {
      setRezultatLoading(false);
    }
  };

  const loadLogisResults = async () => {
    setLogisLoading(true);
    try {
      const { data, error } = await withLoadTimeout(
        supabase.from("logis_results").select("*").order("completed_at", { ascending: false }).limit(200),
        "logis_results"
      );
      noteLoadError("logis_results", error);
      if (data) setLogisResults(data);
    } finally {
      setLogisLoading(false);
    }
  };

  const loadSailsResults = async () => {
    setSailsLoading(true);
    try {
      const { data, error } = await withLoadTimeout(
        supabase.from("sails_results").select("*").order("completed_at", { ascending: false }).limit(200),
        "sails_results"
      );
      noteLoadError("sails_results", error);
      if (data) setSailsResults(data);
    } finally {
      setSailsLoading(false);
    }
  };

  const loadPrimResults = async () => {
    setPrimLoading(true);
    try {
      const { data, error } = await withLoadTimeout(
        supabase.from("prim_results").select("*").order("created_at", { ascending: false }).limit(200),
        "prim_results"
      );
      noteLoadError("prim_results", error);
      if (data) setPrimResults(data);
    } finally {
      setPrimLoading(false);
    }
  };

  async function removeRec(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error, count } = await supabase.from("results").delete({ count: "exact" }).eq("id", id);
    if (error) { console.error(error); alert("Ошибка: " + error.message); return; }
    if (count === 0) { alert("Удаление заблокировано RLS. Запустите fix_delete_rls.sql в Supabase."); return; }
    setResults((prev) => prev.filter((r) => r.id !== id));
    if (open && open.id === id) setOpen(null);
  }

  async function removeTools(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error, count } = await supabase.from("tools_results").delete({ count: "exact" }).eq("id", id);
    if (error) { console.error(error); alert("Ошибка: " + error.message); return; }
    if (count === 0) { alert("Удаление заблокировано RLS. Запустите fix_delete_rls.sql в Supabase."); return; }
    setToolsResults((prev) => prev.filter((r) => r.id !== id));
    if (openTools && openTools.id === id) setOpenTools(null);
  }
  async function removeRezultat(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error, count } = await supabase.from("rezultat_results").delete({ count: "exact" }).eq("id", id);
    if (error) { console.error(error); alert("Ошибка: " + error.message); return; }
    if (count === 0) { alert("Удаление заблокировано RLS. Запустите fix_delete_rls.sql в Supabase."); return; }
    setRezultatResults((prev) => prev.filter((r) => r.id !== id));
    if (openRezultat && openRezultat.id === id) setOpenRezultat(null);
  }
  async function removeLogis(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error, count } = await supabase.from("logis_results").delete({ count: "exact" }).eq("id", id);
    if (error) { console.error(error); alert("Ошибка: " + error.message); return; }
    if (count === 0) { alert("Удаление заблокировано RLS. Запустите fix_delete_rls.sql в Supabase."); return; }
    setLogisResults((prev) => prev.filter((r) => r.id !== id));
    if (openLogis && openLogis.id === id) setOpenLogis(null);
  }
  async function removeSails(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error, count } = await supabase.from("sails_results").delete({ count: "exact" }).eq("id", id);
    if (error) { console.error(error); alert("Ошибка: " + error.message); return; }
    if (count === 0) { alert("Удаление заблокировано RLS. Запустите fix_delete_rls.sql в Supabase."); return; }
    setSailsResults((prev) => prev.filter((r) => r.id !== id));
  }

  async function removePrim(id) {
    if (!window.confirm("Удалить этот результат?")) return;
    const { error } = await supabase.from("prim_results").delete().eq("id", id);
    if (error) { alert("Ошибка: " + error.message); return; }
    setPrimResults((prev) => prev.filter((r) => r.id !== id));
  }

  async function loadAdmins() {
    const { data, error } = await supabase.from("admins").select("*").order("login");
    if (error) { console.error(error); return; }
    setAdmins(data || []);
  }

  async function updateAdminBranch(adminId, branchId) {
    const { error } = await supabase.from("admins").update({ branch_id: branchId || null }).eq("id", adminId);
    if (error) { console.error(error); return; }
    setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, branch_id: branchId || null } : a)));
  }

  // ── ЭКРАН ВХОДА ──
  if (!authorized) {
    return (
      <div style={S.page}><div style={{ ...S.wrap, maxWidth: 420 }}>
        <div style={{ ...S.card, padding: "32px 28px", marginTop: 60 }}>
          <div style={{ ...S.display, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Вход в архив</div>
          <p style={{ color: "#6B675F", fontSize: 14, lineHeight: 1.5, marginTop: 0, marginBottom: 20 }}>
            Доступ только для руководителя.
          </p>
          <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>Логин</label>
          <input value={login} onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 16, borderRadius: 12, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", marginBottom: 14 }} />
          <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>Пароль</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 16, borderRadius: 12, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none" }} />
          {loginError && <div style={{ color: "#E25C44", fontSize: 13, marginTop: 10, fontWeight: 600 }}>Неверный логин или пароль</div>}
          <button onClick={handleLogin} style={{ ...S.btn, ...S.primary, width: "100%", marginTop: 20 }}>Войти</button>
        </div>
      </div></div>
    );
  }

  // ── ПОДРОБНЫЙ ОТЧЁТ ПО КАНДИДАТУ ──
  if (open) {
    const r = JSON.parse(open.report_json);
    const posName = POSITIONS.find((p) => p.id === open.position_id)?.name || open.position_name;
    return (
      <div style={S.page}><div style={S.wrap}>
        <style>{ADMIN_RESPONSIVE_CSS}</style>
        <button onClick={() => setOpen(null)} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14, marginBottom: 18 }}>← К архиву</button>

        <div ref={reportRef} data-admin-report style={{ background: "#F6F5F2", padding: "1px" }}>
        <h1 style={{ ...S.display, fontSize: 26, fontWeight: 700, margin: 0 }}>{open.candidate_name}</h1>
        <div style={{ color: "#8A867E", fontSize: 14, marginTop: 6 }}>
          Должность: {posName}{open.branch_id ? ` · ${branchById(open.branch_id).name}` : ""} · {open.applicant_type === "employee" ? "Действующий сотрудник" : "Кандидат на собеседование"} · {new Date(open.created_at).toLocaleDateString("ru-RU")}
          {open.candidate_email ? ` · ${open.candidate_email}` : ""}
        </div>

        {/* Вердикт */}
        <div style={{ ...S.card, marginTop: 20, borderLeft: `5px solid ${r.isRecommended ? "#2E9E87" : r.fit.startsWith("Высокое") ? "#2E9E87" : r.fit.startsWith("Среднее") ? "#D98E2B" : "#E25C44"}` }}>
          <div style={{ ...S.display, fontSize: 17, fontWeight: 700 }}>
            {r.isRecommended ? `Рекомендуемая должность: ${r.role.name}` : r.fit} ({r.thisRoleFit.fit}%)
          </div>
          <p style={{ margin: "8px 0 0", lineHeight: 1.55, color: "#44413B" }}>{r.fitNote}</p>
        </div>

        {/* Надёжность результатов */}
        <div style={{ ...S.card, borderLeft: `5px solid ${r.consistencyColor || "#8A867E"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#8A867E", marginBottom: 4 }}>
                Надёжность результатов
              </div>
              <div style={{ ...S.display, fontSize: 16, fontWeight: 700, color: r.consistencyColor || "#8A867E" }}>
                {r.consistencyLabel || "Нет данных"}
                {r.consistencyScore != null ? ` — ${r.consistencyScore}%` : ""}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B675F", lineHeight: 1.55 }}>
                {r.consistencyScore == null
                  ? "Запись создана до введения контроля согласованности — данные недоступны."
                  : r.consistencyScore >= 70
                  ? "Ответы на контрольные вопросы совпадают с основным профилем. Результат достоверен."
                  : r.consistencyScore >= 50
                  ? "Часть контрольных ответов расходится с основным профилем. Уточните спорные темы на собеседовании."
                  : "Серьёзные расхождения между основными и контрольными ответами. Возможно, человек отвечал невнимательно или стратегически. Используйте профиль как гипотезу, а не вердикт."}
              </p>
            </div>
            {(r.nullAnswers ?? 0) > 0 && (
              <div style={{ fontSize: 13, color: "#D98E2B", background: "#FBF1E2", border: "1px solid #E8C97A", padding: "8px 14px", borderRadius: 10, fontWeight: 600, whiteSpace: "nowrap", alignSelf: "center" }}>
                ⚠ {r.nullAnswers} вопр. пропущено (таймер)
              </div>
            )}
          </div>
        </div>

        {/* Сводка для руководителя */}
        <div style={{ ...S.card, background: "#1C1B1A", color: "#fff" }}>
          <div style={{ ...S.display, fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#D8D5CF", marginBottom: 12 }}>
            Сводка для руководителя
          </div>
          <p style={{ lineHeight: 1.6, margin: 0, color: "#F1EFEA" }}>{r.portrait}</p>

          <div style={{ ...S.display, fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>Подводные камни</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14, color: "#F1EFEA" }}>
            {r.pitfalls.map((p, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span style={{ color: "#E8A87C", fontWeight: 700 }}>{TALENTS[p.id].name}:</span> {p.text}
              </li>
            ))}
          </ul>

          <div style={{ ...S.display, fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>Что наблюдать в первые недели</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14, color: "#F1EFEA" }}>
            {r.watchpoints.map((w, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <span style={{ color: "#8FD9C4", fontWeight: 700 }}>{TALENTS[w.id].name}:</span> {w.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Профиль доменов */}
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Профиль по доменам</div>
          <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 14 }}>Относительно друг друга — не абсолютная шкала</div>
          {r.domainScores.map((d, i) => (
            <div key={d.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: DOMAINS[d.id].color }}>{i + 1}. {d.id}</span>
                <span style={{ color: "#8A867E" }}>{d.pct}%</span>
              </div>
              <Bar pct={d.pct} color={DOMAINS[d.id].color} />
            </div>
          ))}
        </div>

        {/* Топ-5 */}
        <div style={{ ...S.display, fontSize: 15, fontWeight: 700, margin: "24px 0 4px" }}>Топ-5 сильных сторон</div>
        <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 12 }}>Места 1-20 в профиле кандидата (1 — самая выраженная сторона)</div>
        {r.top5.map((t, i) => {
          const th = TALENTS[t.id];
          const meta = TALENT_META[t.id] || {};
          const dm = DOMAINS[th.domain];
          return (
            <div key={t.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ ...S.display, fontSize: 17, fontWeight: 700 }}>{i + 1}. {th.name}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <DomainTag domain={th.domain} />
                  <span style={{ fontWeight: 700, color: dm.color }}>#{t.rank} · {t.pct}%</span>
                </div>
              </div>
              <p style={{ margin: "10px 0 0", lineHeight: 1.5, color: "#44413B" }}>{th.description}</p>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {meta.plus && (
                  <div style={{ background: "#E4F4F0", borderRadius: 10, padding: "10px 14px", fontSize: 14, lineHeight: 1.5 }}>
                    <b style={{ color: "#2E9E87" }}>За:</b> {meta.plus}
                  </div>
                )}
                {meta.risk && (
                  <div style={{ background: "#FCEAE6", borderRadius: 10, padding: "10px 14px", fontSize: 14, lineHeight: 1.5 }}>
                    <b style={{ color: "#E25C44" }}>Против:</b> {meta.risk}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Соответствие должностям */}
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {r.isRecommended ? "Рейтинг соответствия должностям" : "Соответствие должностям"}
          </div>
          {r.isRecommended && (
            <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 14 }}>
              Должность не выбиралась заранее — кандидат проходил тест без привязки к роли.
            </div>
          )}
          {(r.isRecommended ? r.roleMatches : r.roleMatches.slice(0, 6)).map((m, i) => {
            const isTop = m.roleId === r.thisRoleFit.roleId;
            return (
              <div key={m.roleId} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}>
                  <span style={{ fontWeight: isTop ? 700 : 400 }}>
                    {r.isRecommended ? `${i + 1}. ` : ""}{m.roleName}
                    {isTop ? (r.isRecommended ? " (рекомендуемая)" : " (выбранная)") : ""}
                  </span>
                  <span style={{ color: "#8A867E" }}>{m.fit}%</span>
                </div>
                <Bar pct={m.fit} color={isTop ? "#1C1B1A" : "#D8D5CF"} />
              </div>
            );
          })}
        </div>

        {/* Слабые зоны + вопросы */}
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 15, fontWeight: 700 }}>Наименее выраженные темы (в целом)</div>
          <p style={{ fontSize: 14, color: "#6B675F", lineHeight: 1.5, margin: "8px 0 0" }}>
            {r.bottom3.map((t) => `${TALENTS[t.id].name} (#${t.rank})`).join(" · ")}
          </p>
          <div style={{ ...S.display, fontSize: 15, fontWeight: 700, marginTop: 18 }}>Точечные вопросы для собеседования</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6, fontSize: 14, color: "#44413B" }}>
            {r.targetedQuestions.map((tq, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#8A867E" }}>{TALENTS[tq.id].name} (#{tq.rank}):</span> {tq.q}
              </li>
            ))}
          </ul>
        </div>

        {/* Рекомендации по развитию (для сотрудников) */}
        {r.developmentPlan.length > 0 && (
          <div style={{ ...S.card, background: "#ECEAFB", border: "1px solid #D8D4F5" }}>
            <div style={{ ...S.display, fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#6457D6" }}>Рекомендации по развитию</div>
            <div style={{ fontSize: 13, color: "#6B675F", marginBottom: 12 }}>
              Зоны роста, важные для текущей роли — конкретные шаги, которые можно начать применять уже сейчас.
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14, color: "#44413B" }}>
              {r.developmentPlan.map((d, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6457D6" }}>{TALENTS[d.id].name} (#{d.rank}, {d.pct}%):</span> {d.tip}
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>

        <div data-pdf-actions style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => downloadPdf(open.candidate_name)} disabled={pdfLoading} style={{ ...S.btn, ...S.primary, flex: 1, minWidth: 160, opacity: pdfLoading ? 0.6 : 1 }}>
            {pdfLoading ? "Формирование PDF..." : "Скачать PDF"}
          </button>
          <button onClick={() => copyReport(open.report)} style={{ ...S.btn, ...S.ghost, flex: 1, minWidth: 160 }}>
            {copied ? "Скопировано ✓" : "Скопировать текстом"}
          </button>
          {isSuperAdmin && (
            <button onClick={() => removeRec(open.id)} style={{ ...S.btn, ...S.ghost, flex: 1, minWidth: 160, color: "#E25C44", borderColor: "#F0C4BB" }}>
              Удалить
            </button>
          )}
        </div>
      </div></div>
    );
  }

  // ── УПРАВЛЕНИЕ ФИЛИАЛАМИ (только суперадмин) ──
  if (view === "branches") {
    return (
      <div style={S.page}><div style={S.wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ ...S.display, fontSize: 24, fontWeight: 700, margin: 0 }}>Учётные записи филиалов</h1>
          <button onClick={() => setView("archive")} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>← К архиву</button>
        </div>
        <p style={{ color: "#6B675F", fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          Назначьте каждому логину филиал — руководитель будет видеть только результаты своего филиала.
        </p>
        {admins.length === 0 && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
        {admins.map((a) => (
          <div key={a.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700 }}>{a.login}</div>
            <select value={a.branch_id || ""} onChange={(e) => updateAdminBranch(a.id, e.target.value)}
              style={{ padding: "10px 12px", fontSize: 14, borderRadius: 10, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}>
              <option value="">— без филиала (нет доступа к архиву) —</option>
              {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        ))}
      </div></div>
    );
  }

  // ── СРАВНЕНИЕ ──
  if (view === "compare") {
    const [itemA, itemB] = results.filter((r) => compareIds.has(r.id)).slice(0, 2);
    if (!itemA || !itemB) { setView("archive"); return null; }
    let rA, rB;
    try { rA = JSON.parse(itemA.report_json); rB = JSON.parse(itemB.report_json); } catch { setView("archive"); return null; }
    const DOMAIN_COLORS = { "Исполнение": "#D98E2B", "Влияние": "#E25C44", "Отношения": "#2E9E87", "Мышление": "#6457D6" };

    // Сводная таблица совпадений топ-5 (таланты, которые есть у обоих)
    const topIdsA = new Set(rA.top5.map((t) => t.id));
    const topIdsB = new Set(rB.top5.map((t) => t.id));
    const shared = [...topIdsA].filter((id) => topIdsB.has(id));

    function CandidateHeader({ item, r }) {
      const posName = POSITIONS.find((p) => p.id === item.position_id)?.name || item.position_name;
      const fitColor = (r.fit || "").startsWith("Высокое") ? "#2E9E87" : (r.fit || "").startsWith("Среднее") ? "#D98E2B" : "#E25C44";
      return (
        <div style={{ ...S.card, padding: "14px 16px" }}>
          <div style={{ ...S.display, fontSize: 16, fontWeight: 700 }}>{item.candidate_name}</div>
          <div style={{ fontSize: 12, color: "#8A867E", marginTop: 3 }}>{posName} · {new Date(item.created_at).toLocaleDateString("ru-RU")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: fitColor, marginTop: 6 }}>
            {r.isRecommended ? `Рек. роль: ${r.role.name}` : r.fit} — {r.thisRoleFit.fit}%
          </div>
          {r.consistencyScore != null && (
            <div style={{ fontSize: 12, color: r.consistencyColor, marginTop: 2 }}>Надёжность: {r.consistencyScore}%</div>
          )}
        </div>
      );
    }

    function DomainsCompare() {
      return (
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Профиль по доменам</div>
          {Object.keys(DOMAIN_COLORS).map((d) => {
            const dA = rA.domainScores.find((x) => x.id === d);
            const dB = rB.domainScores.find((x) => x.id === d);
            const pA = dA?.pct ?? 0, pB = dB?.pct ?? 0;
            const color = DOMAIN_COLORS[d];
            return (
              <div key={d} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 5 }}>{d}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 6, alignItems: "center" }}>
                  <div>
                    <div style={{ height: 7, background: "#EEECE7", borderRadius: 99, overflow: "hidden", transform: "scaleX(-1)" }}>
                      <div style={{ width: `${pA}%`, height: "100%", background: color, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#8A867E", marginTop: 2, textAlign: "right" }}>{pA}%</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#8A867E", textAlign: "center" }}>vs</div>
                  <div>
                    <div style={{ height: 7, background: "#EEECE7", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${pB}%`, height: "100%", background: color, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#8A867E", marginTop: 2 }}>{pB}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    function Top5Compare() {
      // Все таланты из топ-5 обоих кандидатов
      const allIds = [...new Set([...rA.top5.map((t) => t.id), ...rB.top5.map((t) => t.id)])];
      return (
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Топ-5 сильных сторон</div>
          {shared.length > 0 && (
            <div style={{ fontSize: 12, color: "#2E9E87", fontWeight: 600, marginBottom: 10 }}>
              Общие: {shared.map((id) => TALENTS[id]?.name).join(", ")}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {/* A */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8A867E", marginBottom: 6 }}>{itemA.candidate_name.split(" ")[0]}</div>
              {rA.top5.map((t) => {
                const isShared = topIdsB.has(t.id);
                return (
                  <div key={t.id} style={{ fontSize: 13, padding: "5px 8px", borderRadius: 8, marginBottom: 4, background: isShared ? "#E4F4F0" : "#F1EFEA", fontWeight: isShared ? 700 : 400, color: isShared ? "#2E9E87" : "#44413B" }}>
                    {TALENTS[t.id]?.name} <span style={{ color: "#8A867E", fontWeight: 400 }}>·{t.pct}%</span>
                  </div>
                );
              })}
            </div>
            {/* B */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8A867E", marginBottom: 6 }}>{itemB.candidate_name.split(" ")[0]}</div>
              {rB.top5.map((t) => {
                const isShared = topIdsA.has(t.id);
                return (
                  <div key={t.id} style={{ fontSize: 13, padding: "5px 8px", borderRadius: 8, marginBottom: 4, background: isShared ? "#E4F4F0" : "#F1EFEA", fontWeight: isShared ? 700 : 400, color: isShared ? "#2E9E87" : "#44413B" }}>
                    {TALENTS[t.id]?.name} <span style={{ color: "#8A867E", fontWeight: 400 }}>·{t.pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    function RoleMatchCompare() {
      // Сравнение fit по всем должностям, что есть у обоих
      const commonRoles = rA.roleMatches.filter((m) => rB.roleMatches.find((x) => x.roleId === m.roleId)).slice(0, 6);
      return (
        <div style={S.card}>
          <div style={{ ...S.display, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Соответствие должностям</div>
          {commonRoles.map((mA) => {
            const mB = rB.roleMatches.find((x) => x.roleId === mA.roleId);
            const leader = mA.fit > mB.fit ? "A" : mA.fit < mB.fit ? "B" : null;
            return (
              <div key={mA.roleId} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{mA.roleName}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 6, alignItems: "center" }}>
                  <div>
                    <div style={{ height: 7, background: "#EEECE7", borderRadius: 99, overflow: "hidden", transform: "scaleX(-1)" }}>
                      <div style={{ width: `${mA.fit}%`, height: "100%", background: leader === "A" ? "#1C1B1A" : "#D8D5CF", borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 11, color: leader === "A" ? "#1C1B1A" : "#8A867E", marginTop: 2, textAlign: "right", fontWeight: leader === "A" ? 700 : 400 }}>{mA.fit}%</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#8A867E", textAlign: "center" }}>vs</div>
                  <div>
                    <div style={{ height: 7, background: "#EEECE7", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${mB.fit}%`, height: "100%", background: leader === "B" ? "#1C1B1A" : "#D8D5CF", borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 11, color: leader === "B" ? "#1C1B1A" : "#8A867E", marginTop: 2, fontWeight: leader === "B" ? 700 : 400 }}>{mB.fit}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div style={S.page}><div style={S.wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ ...S.display, fontSize: 22, fontWeight: 700, margin: 0 }}>Сравнение кандидатов</h1>
          <button onClick={() => setView("archive")} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>← К архиву</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          <CandidateHeader item={itemA} r={rA} />
          <CandidateHeader item={itemB} r={rB} />
        </div>
        <DomainsCompare />
        <Top5Compare />
        <RoleMatchCompare />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={() => setOpen(itemA)} style={{ ...S.btn, ...S.ghost, width: "100%", fontSize: 14 }}>Полный отчёт: {itemA.candidate_name.split(" ")[0]}</button>
          <button onClick={() => setOpen(itemB)} style={{ ...S.btn, ...S.ghost, width: "100%", fontSize: 14 }}>Полный отчёт: {itemB.candidate_name.split(" ")[0]}</button>
        </div>
      </div></div>
    );
  }

  // ── АРХИВ ──
  // Доступные филиалы: суперадмин видит всё (с фильтром), обычный админ — только свой
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (item) => {
    if (!normalizedSearch) return true;
    return [
      item.candidate_name,
      item.name,
      item.candidate_email,
      item.candidate_phone,
      item.candidate_city,
      item.position_name,
    ].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
  };

  const matchesBranch = (item) => {
    if (!isSuperAdmin) {
      if (!myBranchId) return true;
      return !item.branch_id || item.branch_id === myBranchId;
    }
    if (branchFilter === "all") return true;
    return item.branch_id === branchFilter;
  };
  const matchesAudience = (item) => {
    if (!item.applicant_type) return true;
    const value = item.applicant_type;
    return value === typeTab;
  };

  const visibleResults = results
    .filter(matchesBranch)
    .filter(matchesAudience)
    .filter(matchesSearch);

  const filterByBranch = (items) => {
    return items.filter(matchesBranch).filter(matchesAudience).filter(matchesSearch);
  };
  const filterByScope = (items) => {
    return items.filter(matchesBranch).filter(matchesAudience);
  };
  const visibleTools = filterByBranch(toolsResults);
  const visibleRezultat = filterByBranch(rezultatResults);
  const visibleLogis = filterByBranch(logisResults);
  const visibleSails = filterByBranch(sailsResults);
  const visiblePrim = filterByBranch(primResults);

  const personEntries = [
    ...filterByScope(results).map((item) => ({ type: "clifton", item })),
    ...filterByScope(toolsResults).map((item) => ({ type: "tools", item })),
    ...filterByScope(rezultatResults).map((item) => ({ type: "rezultat", item })),
    ...filterByScope(logisResults).map((item) => ({ type: "logis", item })),
    ...filterByScope(sailsResults).map((item) => ({ type: "sails", item })),
    ...filterByScope(primResults).map((item) => ({ type: "prim", item })),
  ];
  const peopleMap = new Map();
  personEntries.forEach((entry) => {
    const name = personName(entry.item);
    const key = entry.item.candidate_key || getCandidateKey({
      email: entry.item.candidate_email,
      phone: entry.item.candidate_phone,
      name,
    });
    const date = resultDate(entry.item);
    const group = peopleMap.get(key) || {
      key,
      name,
      phone: "",
      email: "",
      branchId: entry.item.branch_id || "",
      latestDate: date,
      entries: [],
    };
    group.entries.push(entry);
    group.phone = group.phone || entry.item.candidate_phone || "";
    group.email = group.email || entry.item.candidate_email || "";
    group.branchId = group.branchId || entry.item.branch_id || "";
    if (date && (!group.latestDate || new Date(date) > new Date(group.latestDate))) group.latestDate = date;
    peopleMap.set(key, group);
  });
  const visiblePeople = Array.from(peopleMap.values())
    .filter((person) => {
      if (!normalizedSearch) return true;
      return [
        person.name,
        person.phone,
        person.email,
        ...person.entries.map((entry) => TEST_META[entry.type]?.label),
      ].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
    })
    .sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));

  const archiveStats = [
    ["people", "Люди", visiblePeople.length],
    ["clifton", "Клифтон", visibleResults.length],
    ["tools", "Профиль", visibleTools.length],
    ["rezultat", "Опыт", visibleRezultat.length],
    ["logis", "Логика", visibleLogis.length],
    ["sails", "Продажник", visibleSails.length],
    ["prim", "Анализ", visiblePrim.length],
  ];
  const activeStat = archiveStats.find(([id]) => id === testTab);
  const totalVisible = archiveStats.reduce((sum, [, , count]) => sum + count, 0);

  const getEntriesByType = (person) => person.entries.reduce((acc, entry) => {
    const date = resultDate(entry.item);
    if (!acc[entry.type] || new Date(date || 0) > new Date(resultDate(acc[entry.type].item) || 0)) acc[entry.type] = entry;
    return acc;
  }, {});

  const buildPersonInsight = (person, entriesByType) => {
    const cliftonEntry = entriesByType.clifton?.item;
    const primEntry = entriesByType.prim?.item;
    const toolsEntry = entriesByType.tools?.item;
    const signals = [];
    const risks = [];

    if (cliftonEntry?.fit != null) {
      const fit = Number(cliftonEntry.fit);
      signals.push(`Клифтон: ${fit}% соответствия${cliftonEntry.position_name ? `, ${cliftonEntry.position_name}` : ""}.`);
      if (fit < 55) risks.push("По Клифтону низкое соответствие роли, стоит перепроверить мотивацию и реальные задачи.");
    }

    if (primEntry?.scores) {
      const lowPrim = Object.entries(primEntry.scores).filter(([, value]) => Number(value) <= -25).length;
      if (lowPrim > 0) risks.push(`Анализ: ${lowPrim} факторов в зоне риска.`);
      else signals.push("Анализ: критичных провалов по факторам не видно.");
    }

    if (toolsEntry?.maybe_count != null && toolsEntry.total_questions) {
      const maybeRate = Math.round((toolsEntry.maybe_count / toolsEntry.total_questions) * 100);
      if (maybeRate >= 30) risks.push(`Профиль: много ответов «может быть» (${maybeRate}%), возможна неопределенность.`);
    }

    if (Object.keys(entriesByType).length >= 3) signals.push("Есть несколько тестов, можно смотреть динамику не по одному срезу.");
    return {
      summary: signals[0] || "Пока мало данных: откройте отдельные тесты и сравните выводы.",
      risks: risks.slice(0, 3),
    };
  };

  const getPersonRoleId = (person, entriesByType, profile = {}) => {
    if (profile.target_position_id) return profile.target_position_id;
    const clifton = entriesByType.clifton?.item;
    if (clifton?.target_position_id) return clifton.target_position_id;
    if (clifton?.position_id) return clifton.position_id;
    return "administrator";
  };

  const crmPeople = visiblePeople.map((person) => {
    const entriesByType = getEntriesByType(person);
    const profile = candidateProfiles[person.key] || {};
    const statusId = profile.status || "testing";
    const insight = buildPersonInsight(person, entriesByType);
    const roleId = getPersonRoleId(person, entriesByType, profile);
    const roleName = profile.target_position_name || entriesByType.clifton?.item?.target_position_name || entriesByType.clifton?.item?.position_name || POSITIONS.find((p) => p.id === roleId)?.name || "Администратор";
    const routeProgress = getRouteProgress(entriesByType, roleId);
    const passedCount = Object.keys(entriesByType).length;
    const latestDateMs = person.latestDate ? new Date(person.latestDate).getTime() : 0;
    const focusScore = insight.risks.length * 10 + routeProgress.missingRequired.length * 4 + (profile.manager_comment ? 0 : 2) + Math.min(passedCount, 3);
    return { ...person, entriesByType, profile, statusId, insight, roleId, roleName, routeProgress, passedCount, latestDateMs, focusScore };
  });

  const filteredCrmPeople = crmPeople.filter((person) => crmStatusFilter === "all" || person.statusId === crmStatusFilter);
  const crmCounts = STATUS_OPTIONS.map(([id, label, color]) => ({
    id,
    label,
    color,
    count: crmPeople.filter((person) => person.statusId === id).length,
  }));
  const crmFocusPeople = [...crmPeople]
    .filter((person) => person.insight.risks.length > 0 || !person.profile.manager_comment)
    .sort((a, b) => b.focusScore - a.focusScore || b.latestDateMs - a.latestDateMs)
    .slice(0, 3);
  const crmStats = {
    total: crmPeople.length,
    active: crmPeople.filter((person) => !["hired", "rejected"].includes(person.statusId)).length,
    risk: crmPeople.filter((person) => person.insight.risks.length > 0).length,
    ready: crmPeople.filter((person) => person.passedCount >= 3).length,
  };

  const openPersonTest = (entry) => {
    setTestTab(entry.type);
    setOpen(null);
    setOpenTools(null);
    setOpenRezultat(null);
    setOpenLogis(null);
    setOpenPrim(null);
    if (entry.type === "clifton") setOpen(entry.item);
    if (entry.type === "tools") setOpenTools(entry.item);
    if (entry.type === "rezultat") setOpenRezultat(entry.item);
    if (entry.type === "logis") setOpenLogis(entry.item);
    if (entry.type === "prim") setOpenPrim(entry.item);
  };

  return (
    <div style={S.page}><div style={S.wrap}>
      <style>{ADMIN_RESPONSIVE_CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ ...S.display, fontSize: 24, fontWeight: 700, margin: 0 }}>{testTab === "people" ? "HR CRM" : "Архив результатов"}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <button onClick={() => { loadAdmins(); setView("branches"); }} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Филиалы</button>
          )}
          {testTab === "clifton" && (
            <button
              onClick={() => { setCompareMode((m) => !m); setCompareIds(new Set()); }}
              style={{ ...S.btn, padding: "8px 14px", fontSize: 14, background: compareMode ? "#1C1B1A" : "#F1EFEA", color: compareMode ? "#fff" : "#1C1B1A" }}>
              {compareMode ? "Отмена сравнения" : "Сравнить"}
            </button>
          )}
          <button onClick={() => { setLoadError(""); loadResults(); loadToolsResults(); loadRezultatResults(); loadLogisResults(); loadSailsResults(); loadPrimResults(); loadCandidateProfiles(); }} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Обновить</button>
          <button onClick={() => { setAuthorized(false); setIsSuperAdmin(false); }} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Выйти</button>
        </div>
      </div>

      {/* Переключатель теста */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        {[["people", "👥 Люди"], ["clifton", "🏆 Клифтон"], ["tools", "🎯 Профиль"], ["rezultat", "📋 Опыт"], ["logis", "🧠 Логика"], ["sails", "💎 Продажник"], ["prim", "🧠 Анализ"]].map(([id, label]) => (
          <button key={id} onClick={() => setTestTab(id)}
            style={{ ...S.btn, padding: "10px 20px", fontSize: 14, background: testTab === id ? "#1C1B1A" : "#F1EFEA", color: testTab === id ? "#fff" : "#1C1B1A", whiteSpace: "nowrap", flex: "0 0 auto" }}>
            {label}
          </button>
        ))}
      </div>

      {!isSuperAdmin && myBranchId && (
        <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 14 }}>Филиал: <b>{branchById(myBranchId).name}</b></div>
      )}
      {!isSuperAdmin && !myBranchId && (
        <div style={{ ...S.card, color: "#E25C44" }}>Вашему логину не назначен филиал — обратитесь к администратору.</div>
      )}

      {loadError && (
        <div style={{ ...S.card, borderLeft: "5px solid #E25C44", color: "#6B675F", fontSize: 14, lineHeight: 1.55 }}>
          <b style={{ color: "#E25C44" }}>Есть проблема с загрузкой.</b><br />
          {loadError}
        </div>
      )}

      {isSuperAdmin && (
        <div style={{ marginBottom: 14 }}>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15, borderRadius: 12, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}>
            <option value="all">Все филиалы</option>
            {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по имени, фамилии, телефону или email"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15, borderRadius: 12, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[["candidate", "Кандидаты"], ["employee", "Действующие сотрудники"]].map(([id, label]) => (
          <button key={id} onClick={() => setTypeTab(id)}
            style={{ ...S.btn, flex: 1, padding: "12px 10px", background: typeTab === id ? "#1C1B1A" : "#F1EFEA", color: typeTab === id ? "#fff" : "#1C1B1A", fontSize: 14 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ ...S.card, padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ ...S.display, fontSize: 16, fontWeight: 700 }}>Рабочая сводка</div>
            <div style={{ color: "#6B675F", fontSize: 13, marginTop: 4 }}>
              Сейчас показано: <b>{activeStat?.[2] ?? 0}</b> · всего по фильтрам: <b>{totalVisible}</b>
            </div>
          </div>
          {searchQuery.trim() && (
            <button onClick={() => setSearchQuery("")} style={{ ...S.btn, ...S.ghost, padding: "8px 12px", fontSize: 13 }}>
              Сбросить поиск
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px,1fr))", gap: 8 }}>
          {archiveStats.map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setTestTab(id)}
              style={{
                border: "1.5px solid #EEECE7",
                borderRadius: 12,
                background: testTab === id ? "#1C1B1A" : "#F8F7F4",
                color: testTab === id ? "#fff" : "#1C1B1A",
                padding: "10px 12px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800 }}>{count}</div>
              <div style={{ fontSize: 12, color: testTab === id ? "#D8D5CF" : "#6B675F" }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ────────── ЛЮДИ ────────── */}
      {testTab === "people" && (<>
        <div style={{ ...S.card, padding: 18, marginBottom: 18, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <div style={{ ...S.display, fontSize: 18, fontWeight: 800 }}>Рабочий стол подбора</div>
              <div style={{ color: "#6B675F", fontSize: 13, marginTop: 4 }}>
                Воронка, приоритеты и быстрый доступ к тестам по каждому человеку.
              </div>
            </div>
            {crmStatusFilter !== "all" && (
              <button onClick={() => setCrmStatusFilter("all")} style={{ ...S.btn, ...S.ghost, padding: "8px 12px", fontSize: 13 }}>
                Все статусы
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(138px, 1fr))", gap: 10, marginBottom: 14 }}>
            {[
              ["Всего людей", crmStats.total, "#1C1B1A"],
              ["В работе", crmStats.active, "#2563EB"],
              ["С рисками", crmStats.risk, "#E25C44"],
              ["3+ теста", crmStats.ready, "#2E9E87"],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: "#F8F7F4", border: "1.5px solid #EEECE7", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
                <div style={{ fontSize: 12, color: "#6B675F", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", marginBottom: crmFocusPeople.length ? 14 : 0 }}>
            <button
              onClick={() => setCrmStatusFilter("all")}
              style={{ ...S.btn, padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap", flex: "0 0 auto", background: crmStatusFilter === "all" ? "#1C1B1A" : "#F1EFEA", color: crmStatusFilter === "all" ? "#fff" : "#1C1B1A" }}
            >
              Все · {crmPeople.length}
            </button>
            {crmCounts.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setCrmStatusFilter(stage.id)}
                style={{ ...S.btn, padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap", flex: "0 0 auto", background: crmStatusFilter === stage.id ? stage.color : "#F8F7F4", color: crmStatusFilter === stage.id ? "#fff" : stage.color, border: `1.5px solid ${stage.color}33` }}
              >
                {stage.label} · {stage.count}
              </button>
            ))}
          </div>

          {crmFocusPeople.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {crmFocusPeople.map((person) => {
                const status = STATUS_META[person.statusId] || STATUS_META.testing;
                return (
                  <button
                    key={person.key}
                    onClick={() => setOpenPersonKey(person.key)}
                    style={{ border: "1.5px solid #F3C7BA", background: "#FFF8F5", borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 900, color: "#1C1B1A" }}>{person.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: status.color, background: `${status.color}12`, borderRadius: 99, padding: "4px 8px", whiteSpace: "nowrap" }}>{status.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#6B675F", lineHeight: 1.45, marginTop: 8 }}>
                      {person.insight.risks[0] || "Нет комментария руководителя, стоит зафиксировать решение."}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {(loading || toolsLoading || rezultatLoading || logisLoading || sailsLoading || primLoading) && (
          <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>
        )}
        {filteredCrmPeople.length === 0 && (
          <div style={{ ...S.card, color: "#6B675F" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Людей по этим фильтрам пока нет</div>
            <div style={{ fontSize: 14 }}>Измените статус, поиск или фильтр филиала, чтобы увидеть людей.</div>
          </div>
        )}
        {filteredCrmPeople.map((person) => {
          const isOpenPerson = openPersonKey === person.key;
          const entriesByType = person.entries.reduce((acc, entry) => {
            const date = resultDate(entry.item);
            if (!acc[entry.type] || new Date(date || 0) > new Date(resultDate(acc[entry.type].item) || 0)) acc[entry.type] = entry;
            return acc;
          }, {});
          const latestDate = person.latestDate ? new Date(person.latestDate).toLocaleString("ru-RU") : "—";
          const profile = candidateProfiles[person.key] || {};
          const statusId = profile.status || "testing";
          const status = STATUS_META[statusId] || STATUS_META.testing;
          const insight = buildPersonInsight(person, entriesByType);
          return (
            <div key={person.key} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setOpenPersonKey(isOpenPerson ? null : person.key)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "#fff",
                  padding: "18px 20px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{person.name}</div>
                  <div style={{ fontSize: 12, color: "#8A867E", marginTop: 4 }}>
                    {person.branchId ? branchById(person.branchId).name : "Филиал не указан"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#2563EB", background: "#EEF3FF", borderRadius: 99, padding: "4px 8px" }}>
                      {Object.keys(entriesByType).length}/{Object.keys(TEST_META).length} тестов
                    </span>
                    {insight.risks.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#E25C44", background: "#FCEAE6", borderRadius: 99, padding: "4px 8px" }}>
                        {insight.risks.length} риск
                      </span>
                    )}
                    {person.routeProgress.missingRequired.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#D98E2B", background: "#FBF1E2", borderRadius: 99, padding: "4px 8px" }}>
                        не хватает {person.routeProgress.missingRequired.length}
                      </span>
                    )}
                    {!profile.manager_comment && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#D98E2B", background: "#FBF1E2", borderRadius: 99, padding: "4px 8px" }}>
                        нужна заметка
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: person.phone ? "#1C1B1A" : "#AAA49C" }}>{person.phone || "Телефон —"}</div>
                <div style={{ fontSize: 14, color: person.email ? "#1C1B1A" : "#AAA49C", overflow: "hidden", textOverflow: "ellipsis" }}>{person.email || "Почта —"}</div>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: status.color, background: `${status.color}12`, border: `1px solid ${status.color}24`, borderRadius: 99, padding: "5px 10px" }}>
                    {status.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#8A867E", marginTop: 4 }}>{latestDate}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {Object.entries(TEST_META).map(([type, meta]) => {
                    const passed = Boolean(entriesByType[type]);
                    return (
                      <span key={type} title={meta.label} style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: passed ? meta.bg : "#F1EFEA",
                        color: passed ? meta.color : "#B9B6AF",
                        fontSize: 18,
                        opacity: passed ? 1 : 0.45,
                        border: `1px solid ${passed ? `${meta.color}22` : "#E5E3DE"}`,
                      }}>
                        {meta.icon}
                      </span>
                    );
                  })}
                </div>
              </button>
              {isOpenPerson && (
                <div style={{ borderTop: "1px solid #EEECE7", padding: "16px 20px 20px", background: "#F8F7F4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div style={{ ...S.display, fontSize: 16, fontWeight: 800 }}>360° карточка</div>
                      <div style={{ fontSize: 13, color: "#6B675F", marginTop: 4 }}>
                        Пройдено тестов: <b>{Object.keys(entriesByType).length}</b> из {Object.keys(TEST_META).length} · {person.email || "email не указан"}
                      </div>
                    </div>
                    <button onClick={() => setOpenPersonKey(null)} style={{ ...S.btn, ...S.ghost, padding: "8px 12px", fontSize: 13 }}>Свернуть</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "start", marginBottom: 12 }}>
                    <div style={{ background: "#fff", border: "1.5px solid #EEECE7", borderRadius: 14, padding: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#8A867E", marginBottom: 6 }}>Статус</label>
                      <select
                        value={statusId}
                        onChange={(e) => saveCandidateProfile(person, { status: e.target.value })}
                        style={{ width: "100%", padding: "10px 11px", fontSize: 14, borderRadius: 10, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}
                      >
                        {STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <div style={{ marginTop: 10, fontSize: 12, color: profilesSaving[person.key] ? "#D98E2B" : "#8A867E" }}>
                        {profilesSaving[person.key] ? "Сохраняю..." : "Статус видят руководители"}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                        {["review", "interview", "offer", "hired", "rejected"].map((nextStatusId) => {
                          const nextStatus = STATUS_META[nextStatusId];
                          return (
                            <button
                              key={nextStatusId}
                              onClick={() => saveCandidateProfile(person, { status: nextStatusId })}
                              style={{ border: "none", borderRadius: 99, padding: "6px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: statusId === nextStatusId ? nextStatus.color : `${nextStatus.color}12`, color: statusId === nextStatusId ? "#fff" : nextStatus.color }}
                            >
                              {nextStatus.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ background: "#fff", border: "1.5px solid #EEECE7", borderRadius: 14, padding: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#8A867E", marginBottom: 6 }}>Целевая должность</label>
                      <select
                        value={person.roleId}
                        onChange={(e) => {
                          const selectedRole = POSITIONS.find((p) => p.id === e.target.value);
                          saveCandidateProfile(person, {
                            target_position_id: e.target.value,
                            target_position_name: selectedRole?.name || "",
                          });
                        }}
                        style={{ width: "100%", padding: "10px 11px", fontSize: 14, borderRadius: 10, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}
                      >
                        {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div style={{ marginTop: 10, fontSize: 13, color: "#6B675F", lineHeight: 1.45 }}>
                        {person.routeProgress.reason}
                      </div>
                    </div>
                    <div style={{ background: "#fff", border: "1.5px solid #EEECE7", borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#8A867E", marginBottom: 6 }}>Комментарий руководителя / HR</div>
                      <textarea
                        value={profile.manager_comment || ""}
                        onChange={(e) => setCandidateProfiles((prev) => ({ ...prev, [person.key]: { ...profile, manager_comment: e.target.value } }))}
                        onBlur={(e) => saveCandidateProfile(person, { manager_comment: e.target.value })}
                        placeholder="Например: пригласить на второе интервью, проверить стрессоустойчивость, уточнить мотивацию..."
                        rows={3}
                        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "11px 12px", fontSize: 14, lineHeight: 1.5, borderRadius: 10, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}
                      />
                    </div>
                  </div>
                  <div style={{ background: "#fff", border: "1.5px solid #EEECE7", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8A867E", marginBottom: 4 }}>Маршрут оценки</div>
                        <div style={{ fontWeight: 900 }}>{person.roleName}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: person.routeProgress.missingRequired.length ? "#D98E2B" : "#2E9E87" }}>
                        {person.routeProgress.missingRequired.length ? `Не хватает: ${person.routeProgress.missingRequired.length}` : "Картина полная"}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                      {[...person.routeProgress.required.map((testId) => [testId, true]), ...person.routeProgress.optional.map((testId) => [testId, false])].map(([testId, required]) => {
                        const meta = TEST_ROUTE_META[testId];
                        const done = Boolean(person.entriesByType[testId]);
                        return (
                          <button
                            key={`${testId}-${required ? "required" : "optional"}`}
                            onClick={() => person.entriesByType[testId] && openPersonTest(person.entriesByType[testId])}
                            disabled={!done}
                            style={{ border: `1.5px solid ${done ? "#BFE2D8" : required ? "#F3C7BA" : "#EEECE7"}`, background: done ? "#E4F4F0" : required ? "#FFF4F0" : "#F8F7F4", borderRadius: 12, padding: "10px 11px", textAlign: "left", cursor: done ? "pointer" : "default", fontFamily: "inherit", opacity: done || required ? 1 : 0.72 }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <span style={{ fontWeight: 900 }}>{meta.icon} {meta.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: done ? "#2E9E87" : required ? "#E25C44" : "#8A867E" }}>{done ? "✓" : required ? "!" : "·"}</span>
                            </div>
                            <div style={{ fontSize: 11, color: done ? "#2E9E87" : required ? "#E25C44" : "#8A867E", marginTop: 4 }}>
                              {done ? "Пройден" : required ? "Обязательный" : "Дополнительно"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
                    <div style={{ background: "#fff", border: "1.5px solid #EEECE7", borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#8A867E", marginBottom: 6 }}>Короткий вывод</div>
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: "#1C1B1A" }}>{insight.summary}</div>
                    </div>
                    <div style={{ background: insight.risks.length ? "#FFF4F0" : "#E4F4F0", border: `1.5px solid ${insight.risks.length ? "#F3C7BA" : "#BFE2D8"}`, borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: insight.risks.length ? "#E25C44" : "#2E9E87", marginBottom: 6 }}>Подводные камни</div>
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: "#1C1B1A" }}>
                        {insight.risks.length ? insight.risks.join(" ") : "Явных красных флагов по текущим тестам не найдено."}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#fff", border: "1.5px solid #D8D4F5", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#6457D6", marginBottom: 4 }}>Пост-найм наблюдение</div>
                        <div style={{ fontSize: 13, color: "#6B675F", lineHeight: 1.45 }}>
                          Заполняется после 2-8 недель работы, чтобы сверить прогноз тестов с реальным поведением.
                        </div>
                      </div>
                      <button
                        onClick={() => saveCandidateProfile(person, {
                          status: "hired",
                          hired_feedback_date: new Date().toISOString(),
                        })}
                        style={{ border: "none", borderRadius: 99, padding: "8px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", background: "#E4F4F0", color: "#2E9E87", alignSelf: "flex-start" }}
                      >
                        Отметить как принят
                      </button>
                    </div>
                    <textarea
                      value={profile.hired_feedback || ""}
                      onChange={(e) => setCandidateProfiles((prev) => ({ ...prev, [person.key]: { ...profile, hired_feedback: e.target.value } }))}
                      onBlur={(e) => saveCandidateProfile(person, {
                        hired_feedback: e.target.value,
                        hired_feedback_date: e.target.value.trim() ? (profile.hired_feedback_date || new Date().toISOString()) : null,
                      })}
                      placeholder="Что подтвердилось? Что не совпало? Как человек держит темп, общается, продает, учится, реагирует на стресс?"
                      rows={3}
                      style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "11px 12px", fontSize: 14, lineHeight: 1.5, borderRadius: 10, border: "1.5px solid #D8D5CF", fontFamily: "inherit", outline: "none", background: "#fff" }}
                    />
                    {profile.hired_feedback_date && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#8A867E" }}>
                        Обновлено: {new Date(profile.hired_feedback_date).toLocaleDateString("ru-RU")}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    {Object.entries(TEST_META).map(([type, meta]) => {
                      const entry = entriesByType[type];
                      const date = entry ? resultDate(entry.item) : null;
                      return (
                        <div key={type} style={{
                          background: "#fff",
                          border: `1.5px solid ${entry ? `${meta.color}33` : "#EEECE7"}`,
                          borderRadius: 14,
                          padding: 14,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ width: 34, height: 34, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: meta.bg, color: meta.color, fontSize: 17 }}>
                              {meta.icon}
                            </span>
                            <div>
                              <div style={{ fontWeight: 800 }}>{meta.label}</div>
                              <div style={{ fontSize: 12, color: entry ? "#2E9E87" : "#AAA49C" }}>{entry ? "Пройден" : "Нет результата"}</div>
                            </div>
                          </div>
                          {entry && (
                            <>
                              <div style={{ fontSize: 12, color: "#8A867E", marginBottom: 10 }}>
                                {date ? new Date(date).toLocaleString("ru-RU") : "Дата не указана"}
                              </div>
                              <button onClick={() => openPersonTest(entry)} style={{ ...S.btn, width: "100%", padding: "9px 12px", fontSize: 13, background: meta.bg, color: meta.color }}>
                                Открыть тест
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </>)} {/* конец Люди */}

      {/* ────────── КЛИФТОН ────────── */}
      {testTab === "clifton" && (<>

      {/* Плавающая панель сравнения */}
      {compareMode && compareIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "#1C1B1A", color: "#fff", borderRadius: 16, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {compareIds.size === 1 ? "Выберите ещё одного" : "Готово к сравнению"}
          </span>
          {compareIds.size === 2 && (
            <button onClick={() => setView("compare")} style={{ ...S.btn, background: "#fff", color: "#1C1B1A", padding: "9px 18px", fontSize: 14 }}>
              Сравнить →
            </button>
          )}
        </div>
      )}

      {loading && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
      {!loading && visibleResults.length === 0 && (
        <div style={{ ...S.card, color: "#6B675F" }}>Пока пусто в этой категории.</div>
      )}
      {visibleResults.map((item) => {
        let top3 = [];
        let parsed = null;
        try {
          parsed = JSON.parse(item.report_json);
          top3 = parsed.top5.slice(0, 3).map((t) => TALENTS[t.id]?.name).filter(Boolean);
        } catch {}
        const posName = POSITIONS.find((p) => p.id === item.position_id)?.name || item.position_name;
        const branchName = item.branch_id ? branchById(item.branch_id).name : null;
        const isSelected = compareIds.has(item.id);
        const consistency = parsed?.consistencyScore;
        const riskCount = parsed?.pitfalls?.length || 0;
        const fitColor = item.fit >= 75 ? "#2E9E87" : item.fit >= 55 ? "#D98E2B" : "#E25C44";
        return (
          <div key={item.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", outline: isSelected ? "2.5px solid #1C1B1A" : "none" }}>
            <div style={{ flex: "1 1 320px" }}>
              <div style={{ fontWeight: 700 }}>{item.candidate_name}</div>
              <div style={{ fontSize: 13, color: "#8A867E", marginTop: 2 }}>
                {item.position_recommended ? `Рекомендуется: ${posName}` : posName}{branchName ? ` · ${branchName}` : ""} · {new Date(item.created_at).toLocaleDateString("ru-RU")} · {item.fit}%
              </div>
              {top3.length > 0 && (
                <div style={{ fontSize: 13, color: "#44413B", marginTop: 4 }}>Топ-3: {top3.join(", ")}</div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: fitColor, background: "#F8F7F4", border: `1px solid ${fitColor}33`, padding: "4px 9px", borderRadius: 99 }}>
                  Fit {item.fit}%
                </span>
                {consistency != null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: consistency >= 70 ? "#2E9E87" : consistency >= 50 ? "#D98E2B" : "#E25C44", background: "#F8F7F4", padding: "4px 9px", borderRadius: 99 }}>
                    Надёжность {consistency}%
                  </span>
                )}
                {riskCount > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#E25C44", background: "#FCEAE6", padding: "4px 9px", borderRadius: 99 }}>
                    {riskCount} подводн. камня
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {compareMode ? (
                <button
                  onClick={() => {
                    setCompareIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) { next.delete(item.id); }
                      else if (next.size < 2) { next.add(item.id); }
                      return next;
                    });
                  }}
                  style={{ ...S.btn, padding: "9px 16px", fontSize: 14, background: isSelected ? "#1C1B1A" : "#F1EFEA", color: isSelected ? "#fff" : "#1C1B1A" }}>
                  {isSelected ? "✓ Выбран" : "Выбрать"}
                </button>
              ) : (
                <>
                  <button onClick={() => setOpen(item)} disabled={!item.report_json}
                    style={{ ...S.btn, ...S.primary, padding: "9px 16px", fontSize: 14, opacity: item.report_json ? 1 : 0.4 }}>
                    Открыть
                  </button>
                  {isSuperAdmin && (
                    <button onClick={() => removeRec(item.id)}
                      style={{ ...S.btn, ...S.ghost, padding: "9px 14px", fontSize: 14, color: "#E25C44", borderColor: "#F0C4BB" }}>
                      Удалить
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      </>)} {/* конец Клифтон */}

      {/* ────────── ТУЛС ────────── */}
      {testTab === "tools" && (<>
        {openTools ? (
          // Подробная карточка Профиль
          <div>
            <div data-pdf-actions style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => setOpenTools(null)}
                style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>
                ← Назад к списку
              </button>
              <button onClick={() => downloadPdf(openTools.candidate_name)}
                style={{ ...S.btn, padding: "8px 14px", fontSize: 13, background: "#EEF3FF", color: "#3B7BF6" }}>
                {pdfLoading ? "Создаём PDF..." : "⬇ Скачать PDF"}
              </button>
              {isSuperAdmin && (
                <button onClick={() => removeTools(openTools.id)}
                  style={{ ...S.btn, padding: "8px 14px", fontSize: 13, background: "#FEE2E2", color: "#DC2626" }}>
                  🗑 Удалить
                </button>
              )}
            </div>
            <div ref={reportRef} data-admin-report style={S.card}>
              <ToolsResultCard rec={openTools} />
            </div>
          </div>
        ) : (
          // Список результатов Профиль
          <>
            {toolsLoading && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
            {!toolsLoading && visibleTools.length === 0 && (
              <div style={{ ...S.card, color: "#6B675F" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Результатов Профиль пока нет</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                  Загрузите результаты через скрипт импорта (import_tools.py) из папки с PDF-файлами.
                </p>
              </div>
            )}
            {visibleTools.map((item) => {
              const scores = item.scores || {};
              const topInd = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
              return (
                <div key={item.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.candidate_name}</div>
                    <div style={{ fontSize: 13, color: "#8A867E", marginTop: 2 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString("ru-RU") : ""}
                      {item.answers_count ? ` · Ответов: ${item.answers_count}/200` : ""}
                    </div>
                    {topInd.length > 0 && (
                      <div style={{ fontSize: 13, color: "#44413B", marginTop: 4 }}>
                        Топ: {topInd.join(", ")}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setOpenTools(item)}
                      style={{ ...S.btn, ...S.primary, padding: "9px 16px", fontSize: 14 }}>
                      Открыть
                    </button>
                    {isSuperAdmin && (
                      <button onClick={() => removeTools(item.id)}
                        style={{ ...S.btn, padding: "9px 12px", fontSize: 13, background: "#FEE2E2", color: "#DC2626", borderRadius: 10 }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </>)} {/* конец Профиль */}

      {testTab === "rezultat" && (<>
        {openRezultat ? (
          <div>
            <div data-pdf-actions style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button onClick={() => downloadPdf(openRezultat.candidate_name)}
                style={{ ...S.btn, padding: "8px 14px", fontSize: 13, background: "#EEF3FF", color: "#3B7BF6" }}>
                {pdfLoading ? "Создаём PDF..." : "⬇ Скачать PDF"}
              </button>
              {isSuperAdmin && (
                <button onClick={() => removeRezultat(openRezultat.id)}
                  style={{ ...S.btn, padding: "8px 14px", fontSize: 13, background: "#FEE2E2", color: "#DC2626" }}>
                  🗑 Удалить
                </button>
              )}
            </div>
            <div ref={reportRef} data-admin-report>
              <RezultResultCard result={openRezultat} onClose={() => setOpenRezultat(null)} forceExpanded={pdfMode} />
            </div>
          </div>
        ) : (
          <>
            {rezultatLoading && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
            {!rezultatLoading && visibleRezultat.length === 0 && (
              <div style={{ ...S.card }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Результатов Опыт пока нет</div>
                <div style={{ color: "#6B675F", fontSize: 14 }}>Кандидаты смогут проходить тест Опыт через главную страницу.</div>
              </div>
            )}
            {visibleRezultat.map((item) => {
              const date = item.created_at ? new Date(item.created_at).toLocaleDateString("ru-RU") : "—";
              const jobsCount = item.jobs ? item.jobs.length : 1;
              return (
                <div key={item.id} style={{ ...S.card, cursor: "pointer", marginBottom: 10 }}
                  onClick={() => setOpenRezultat(item)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{item.candidate_name}</div>
                      <div style={{ fontSize: 13, color: "#8A867E", marginTop: 2 }}>
                        {item.candidate_age ? `${item.candidate_age} лет · ` : ""}{date}
                        {item.candidate_city ? ` · ${item.candidate_city}` : ""}
                        {jobsCount > 1 ? ` · ${jobsCount} места работы` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 13, color: "#3B7BF6" }}>Открыть →</div>
                      {isSuperAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); removeRezultat(item.id); }}
                          style={{ ...S.btn, padding: "5px 10px", fontSize: 12, background: "#FEE2E2", color: "#DC2626", borderRadius: 8 }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </>)} {/* конец Опыт */}

      {testTab === "logis" && (<>
        {openLogis ? (
          <div ref={reportRef} data-admin-report style={S.card}>
            <div data-pdf-actions style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <button onClick={() => setOpenLogis(null)} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>
                ← К списку
              </button>
              <button onClick={() => downloadPdf(openLogis.name)}
                style={{ ...S.btn, padding: "8px 14px", fontSize: 13, background: "#EEF3FF", color: "#3B7BF6" }}>
                {pdfLoading ? "Создаём PDF..." : "⬇ Скачать PDF"}
              </button>
              {isSuperAdmin && (
                <button onClick={() => removeLogis(openLogis.id)}
                  style={{ ...S.btn, padding: "8px 14px", fontSize: 13, background: "#FEE2E2", color: "#DC2626" }}>
                  🗑 Удалить
                </button>
              )}
            </div>
            <h2 style={{ margin: "0 0 6px" }}>{openLogis.name}</h2>
            <div style={{ color: "#8A867E", fontSize: 14, marginBottom: 20 }}>
              {openLogis.completed_at ? new Date(openLogis.completed_at).toLocaleString("ru-RU") : "—"}
            </div>
            <div style={{ display: "flex", gap: 32, marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: openLogis.score >= 120 ? "#43a047" : openLogis.score >= 100 ? "#fb8c00" : "#e53935" }}>
                  {openLogis.score}
                </div>
                <div style={{ fontSize: 13, color: "#8A867E" }}>Балл (из 160)</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: "#333" }}>{openLogis.correct_answers}</div>
                <div style={{ fontSize: 13, color: "#8A867E" }}>Правильных из 80</div>
              </div>
            </div>
            <div style={{ fontSize: 14, color: "#555" }}>
              Уровень IQ:&nbsp;<strong>
                {openLogis.score >= 130 ? "Очень высокий" :
                 openLogis.score >= 120 ? "Высокий" :
                 openLogis.score >= 110 ? "Выше среднего" :
                 openLogis.score >= 100 ? "Средний" :
                 openLogis.score >= 90  ? "Ниже среднего" : "Низкий"}
              </strong>
            </div>
            <AnalysisBlock analysis={logisAnalysis(openLogis.score, openLogis.correct_answers)} />
          </div>
        ) : (
          <>
            {logisLoading && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
            {!logisLoading && visibleLogis.length === 0 && (
              <div style={{ ...S.card }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Результатов Логика пока нет</div>
                <div style={{ color: "#6B675F", fontSize: 14 }}>Кандидаты смогут проходить тест через главную страницу.</div>
              </div>
            )}
            {visibleLogis.map((item) => {
              const date = item.completed_at ? new Date(item.completed_at).toLocaleDateString("ru-RU") : "—";
              const level = item.score >= 130 ? "Очень высокий" :
                            item.score >= 120 ? "Высокий" :
                            item.score >= 110 ? "Выше среднего" :
                            item.score >= 100 ? "Средний" :
                            item.score >= 90  ? "Ниже среднего" : "Низкий";
              return (
                <div key={item.id} style={{ ...S.card, cursor: "pointer", marginBottom: 10 }}
                  onClick={() => setOpenLogis(item)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "#8A867E", marginTop: 2 }}>
                        {date} · Балл: {item.score} · {level}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.score >= 120 ? "#43a047" : item.score >= 100 ? "#fb8c00" : "#e53935" }}>
                        {item.score}
                      </div>
                      {isSuperAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); removeLogis(item.id); }}
                          style={{ ...S.btn, padding: "5px 10px", fontSize: 12, background: "#FEE2E2", color: "#DC2626", borderRadius: 8 }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </>)} {/* конец Логика */}

      {testTab === "sails" && (<>
        <h3 style={{ ...S.display, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>💎 Результаты Продажник</h3>
        {sailsLoading && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
        {!sailsLoading && visibleSails.length === 0 && (
          <div style={{ ...S.card }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Результатов Продажник пока нет</div>
            <div style={{ color: "#6B675F", fontSize: 14 }}>Они появятся после прохождения теста.</div>
          </div>
        )}
        {visibleSails.map((item) => {
          const ans = item.answers || {};
          const yesCount = Object.values(ans).filter(v => v === "yes").length;
          const noCount = Object.values(ans).filter(v => v === "no").length;
          const sometimesCount = Object.values(ans).filter(v => v === "sometimes").length;
          const total = Object.keys(ans).length;
          const sc = item.scales || {};
          return (
            <div key={item.id} data-admin-report data-pdf-card style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{item.name}</div>
                  <div style={{ color: "#6B675F", fontSize: 13, marginTop: 4 }}>
                    {new Date(item.completed_at).toLocaleString("ru")}
                  </div>
                </div>
                <div data-pdf-actions style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4caf50", background: "#e8f5e9", padding: "3px 10px", borderRadius: 99 }}>Да: {yesCount}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ff9800", background: "#fff3e0", padding: "3px 10px", borderRadius: 99 }}>Иногда: {sometimesCount}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#f44336", background: "#ffebee", padding: "3px 10px", borderRadius: 99 }}>Нет: {noCount}</span>
                  <span style={{ fontSize: 12, color: "#6B675F", background: "#f5f5f5", padding: "3px 10px", borderRadius: 99 }}>{total}/120</span>
                  <button onClick={(e) => downloadPdf(item.name, e.currentTarget.closest("[data-pdf-card]"))}
                    style={{ ...S.btn, padding: "4px 10px", fontSize: 12, background: "#EEF3FF", color: "#3B7BF6", borderRadius: 8 }}>
                    {pdfLoading ? "PDF..." : "⬇ PDF"}
                  </button>
                  {isSuperAdmin && (
                    <button onClick={() => removeSails(item.id)}
                      style={{ ...S.btn, padding: "4px 10px", fontSize: 12, background: "#FEE2E2", color: "#DC2626", borderRadius: 8 }}>
                      ✕ Удалить
                    </button>
                  )}
                </div>
              </div>
              {Object.keys(sc).length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                  {Object.entries(SAILS_SCALE_NAMES).map(([code, name]) => {
                    const score = sc[code] ?? 0;
                    const lvl = sailsLevel(score);
                    return (
                      <div key={code}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: "#444" }}>
                            <span style={{ color: "#9c27b0", fontWeight: 700, marginRight: 4 }}>{code}</span>
                            {name}
                            <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>— {SAILS_SCALE_DESC[code]}</span>
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "#888" }}>{lvl.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#222", minWidth: 24, textAlign: "right" }}>{score}</span>
                          </div>
                        </div>
                        <div style={{ height: 5, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${score}%`, background: lvl.color, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {Object.keys(sc).length > 0 && (
                <AnalysisBlock analysis={sailsAnalysis(sc)} />
              )}
            </div>
          );
        })}
      </>)} {/* конец Продажник */}

      {testTab === "prim" && (<>
        <h3 style={{ fontFamily: "'Unbounded', 'Golos Text', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🧠 Результаты Первичный анализ</h3>
        {primLoading && <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(28,27,26,.07)", color: "#6B675F" }}>Загрузка...</div>}
        {!primLoading && visiblePrim.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(28,27,26,.07)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Результатов Первичный анализ пока нет</div>
            <div style={{ color: "#6B675F", fontSize: 14 }}>Они появятся после прохождения теста.</div>
          </div>
        )}
        {visiblePrim.map((item) => (
          <div key={item.id} data-admin-report data-pdf-card style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(28,27,26,.07)", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{item.candidate_name}</div>
                <div style={{ color: "#6B675F", fontSize: 13, marginTop: 4 }}>
                  {new Date(item.created_at).toLocaleString("ru")}
                  {item.candidate_age ? ` · ${item.candidate_age} лет` : ""}
                  {item.maybe_count != null ? ` · «Может быть»: ${item.maybe_count}` : ""}
                </div>
              </div>
              <div data-pdf-actions style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={() => setOpenPrim(openPrim?.id === item.id ? null : item)}
                  style={{ border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "9px 16px", background: openPrim?.id === item.id ? "#1C1B1A" : "#F1EFEA", color: openPrim?.id === item.id ? "#fff" : "#1C1B1A" }}>
                  {openPrim?.id === item.id ? "Закрыть" : "Подробнее"}
                </button>
                {openPrim?.id === item.id && (
                  <button onClick={(e) => downloadPdf(item.candidate_name, e.currentTarget.closest("[data-pdf-card]"))}
                    style={{ border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "9px 14px", background: "#EEF3FF", color: "#3B7BF6" }}>
                    {pdfLoading ? "PDF..." : "⬇ PDF"}
                  </button>
                )}
                {isSuperAdmin && (
                  <button onClick={() => removePrim(item.id)}
                    style={{ border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px", background: "#FEE2E2", color: "#DC2626" }}>
                    ✕ Удалить
                  </button>
                )}
              </div>
            </div>
            {openPrim?.id === item.id && <PrimResultCard result={item} forceExpanded={pdfMode} />}
          </div>
        ))}
      </>)} {/* конец Первичный анализ */}

    </div></div>
  );
}
