import { useState, useRef } from "react";
import { supabase } from "./supabase";
import { S, Bar, DomainTag, DOMAINS, TALENT_META, TALENTS, POSITIONS, BRANCHES, branchById } from "./App";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState(new Set());
  const reportRef = useRef(null);

  const handleLogin = async () => {
    const { data } = await supabase
      .from("admins")
      .select("*")
      .eq("login", login.trim())
      .eq("password", password)
      .maybeSingle();

    if (data) {
      setLoginError(false);
      setAuthorized(true);
      const superAdmin = login.trim() === "vvvorobyev1991";
      setIsSuperAdmin(superAdmin);
      setMyBranchId(superAdmin ? null : data.branch_id || null);
      loadResults();
    } else {
      setLoginError(true);
    }
  };

  const loadResults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) console.error(error);
    if (data) setResults(data);
    setLoading(false);
  };

  function copyReport(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) { console.error(e); }
  }

  async function downloadPdf(candidateName) {
    if (!reportRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const node = reportRef.current;
      const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#F6F5F2" });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      const pdf = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = pageWidth / canvas.width;
      const imgHeight = canvas.height * ratio;

      // если контент длиннее одной страницы — разбиваем на несколько A4-страниц
      const a4Width = 794; // px при 96dpi для A4
      const a4Height = 1123;
      const scaleToA4 = a4Width / canvas.width;
      const totalHeightOnA4 = canvas.height * scaleToA4;
      const pageCount = Math.ceil(totalHeightOnA4 / a4Height);

      const finalPdf = new jsPDF({ unit: "px", format: [a4Width, a4Height] });
      for (let i = 0; i < pageCount; i++) {
        if (i > 0) finalPdf.addPage([a4Width, a4Height]);
        const yOffset = -i * a4Height;
        finalPdf.addImage(imgData, "JPEG", 0, yOffset, a4Width, totalHeightOnA4);
      }

      const safeName = (candidateName || "report").replace(/[^\p{L}\p{N}_-]+/gu, "_");
      finalPdf.save(`${safeName}_отчёт.pdf`);
    } catch (e) {
      console.error(e);
      window.alert("Не удалось сформировать PDF. Попробуйте ещё раз.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function removeRec(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error } = await supabase.from("results").delete().eq("id", id);
    if (error) { console.error(error); return; }
    setResults((prev) => prev.filter((r) => r.id !== id));
    if (open && open.id === id) setOpen(null);
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
        <button onClick={() => setOpen(null)} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14, marginBottom: 18 }}>← К архиву</button>

        <div ref={reportRef} style={{ background: "#F6F5F2", padding: "1px" }}>
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
  const visibleResults = results.filter((item) => {
    if (!isSuperAdmin) return item.branch_id === myBranchId;
    if (branchFilter === "all") return true;
    return item.branch_id === branchFilter;
  }).filter((item) => item.applicant_type === typeTab || (!item.applicant_type && typeTab === "employee"));

  return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ ...S.display, fontSize: 24, fontWeight: 700, margin: 0 }}>Архив результатов</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <button onClick={() => { loadAdmins(); setView("branches"); }} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Филиалы</button>
          )}
          <button
            onClick={() => { setCompareMode((m) => !m); setCompareIds(new Set()); }}
            style={{ ...S.btn, padding: "8px 14px", fontSize: 14, background: compareMode ? "#1C1B1A" : "#F1EFEA", color: compareMode ? "#fff" : "#1C1B1A" }}>
            {compareMode ? "Отмена сравнения" : "Сравнить"}
          </button>
          <button onClick={loadResults} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Обновить</button>
          <button onClick={() => { setAuthorized(false); setIsSuperAdmin(false); }} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Выйти</button>
        </div>
      </div>

      {!isSuperAdmin && myBranchId && (
        <div style={{ fontSize: 13, color: "#8A867E", marginBottom: 14 }}>Филиал: <b>{branchById(myBranchId).name}</b></div>
      )}
      {!isSuperAdmin && !myBranchId && (
        <div style={{ ...S.card, color: "#E25C44" }}>Вашему логину не назначен филиал — обратитесь к администратору.</div>
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

      {/* Таб Сотрудники / Кандидаты */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[["employee", "Сотрудники"], ["candidate", "Кандидаты"]].map(([id, label]) => (
          <button key={id} onClick={() => setTypeTab(id)}
            style={{ ...S.btn, flex: 1, padding: "12px 0", background: typeTab === id ? "#1C1B1A" : "#F1EFEA", color: typeTab === id ? "#fff" : "#1C1B1A" }}>
            {label}
          </button>
        ))}
      </div>

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
        try {
          const r = JSON.parse(item.report_json);
          top3 = r.top5.slice(0, 3).map((t) => TALENTS[t.id]?.name).filter(Boolean);
        } catch {}
        const posName = POSITIONS.find((p) => p.id === item.position_id)?.name || item.position_name;
        const branchName = item.branch_id ? branchById(item.branch_id).name : null;
        const isSelected = compareIds.has(item.id);
        return (
          <div key={item.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", outline: isSelected ? "2.5px solid #1C1B1A" : "none" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.candidate_name}</div>
              <div style={{ fontSize: 13, color: "#8A867E", marginTop: 2 }}>
                {item.position_recommended ? `Рекомендуется: ${posName}` : posName}{branchName ? ` · ${branchName}` : ""} · {new Date(item.created_at).toLocaleDateString("ru-RU")} · {item.fit}%
              </div>
              {top3.length > 0 && (
                <div style={{ fontSize: 13, color: "#44413B", marginTop: 4 }}>Топ-3: {top3.join(", ")}</div>
              )}
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
    </div></div>
  );
}
