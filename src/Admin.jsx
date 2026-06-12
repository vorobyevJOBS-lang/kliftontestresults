import { useState } from "react";
import { supabase } from "./supabase";
import { S, Bar, DomainTag, DOMAINS, TALENT_META, TALENTS, POSITIONS, SCHOOLS } from "./App";

export default function Admin() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null); // выбранная запись для подробного просмотра
  const [copied, setCopied] = useState(false);

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
      setIsSuperAdmin(login.trim() === "vvvorobyev1991");
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

  async function removeRec(id) {
    if (!window.confirm("Удалить этот результат без возможности восстановления?")) return;
    const { error } = await supabase.from("results").delete().eq("id", id);
    if (error) { console.error(error); return; }
    setResults((prev) => prev.filter((r) => r.id !== id));
    if (open && open.id === id) setOpen(null);
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

        <h1 style={{ ...S.display, fontSize: 26, fontWeight: 700, margin: 0 }}>{open.candidate_name}</h1>
        <div style={{ color: "#8A867E", fontSize: 14, marginTop: 6 }}>
          Должность: {posName}{open.school_id ? ` · ${SCHOOLS.find((s) => s.id === open.school_id)?.name || open.school_id}` : ""} · {open.applicant_type === "employee" ? "Действующий сотрудник" : "Кандидат на собеседование"} · {new Date(open.created_at).toLocaleDateString("ru-RU")}
          {open.candidate_email ? ` · ${open.candidate_email}` : ""}
        </div>

        {/* Вердикт */}
        <div style={{ ...S.card, marginTop: 20, borderLeft: `5px solid ${r.isRecommended ? "#2E9E87" : r.fit.startsWith("Высокое") ? "#2E9E87" : r.fit.startsWith("Среднее") ? "#D98E2B" : "#E25C44"}` }}>
          <div style={{ ...S.display, fontSize: 17, fontWeight: 700 }}>
            {r.isRecommended ? `Рекомендуемая должность: ${r.role.name}` : r.fit} ({r.thisRoleFit.fit}%)
          </div>
          <p style={{ margin: "8px 0 0", lineHeight: 1.55, color: "#44413B" }}>{r.fitNote}</p>
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

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => copyReport(open.report)} style={{ ...S.btn, ...S.primary, flex: 1 }}>
            {copied ? "Скопировано ✓" : "Скопировать отчёт текстом"}
          </button>
          {isSuperAdmin && (
            <button onClick={() => removeRec(open.id)} style={{ ...S.btn, ...S.ghost, flex: 1, color: "#E25C44", borderColor: "#F0C4BB" }}>
              Удалить
            </button>
          )}
        </div>
      </div></div>
    );
  }

  // ── АРХИВ ──
  return (
    <div style={S.page}><div style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ ...S.display, fontSize: 24, fontWeight: 700, margin: 0 }}>Архив результатов</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadResults} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Обновить</button>
          <button onClick={() => { setAuthorized(false); setIsSuperAdmin(false); }} style={{ ...S.btn, ...S.ghost, padding: "8px 14px", fontSize: 14 }}>Выйти</button>
        </div>
      </div>

      {loading && <div style={{ ...S.card, color: "#6B675F" }}>Загрузка...</div>}
      {!loading && results.length === 0 && (
        <div style={{ ...S.card, color: "#6B675F" }}>Пока пусто. Результаты появятся здесь после первого пройденного теста.</div>
      )}
      {results.map((item) => {
        let top3 = [];
        try {
          const r = JSON.parse(item.report_json);
          top3 = r.top5.slice(0, 3).map((t) => TALENTS[t.id]?.name).filter(Boolean);
        } catch {}
        const posName = POSITIONS.find((p) => p.id === item.position_id)?.name || item.position_name;
        const schoolName = SCHOOLS.find((s) => s.id === item.school_id)?.name || item.school_id;
        const typeName = item.applicant_type === "employee" ? "Сотрудник" : "Кандидат";
        return (
          <div key={item.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.candidate_name}</div>
              <div style={{ fontSize: 13, color: "#8A867E", marginTop: 2 }}>
                {item.position_recommended ? `Рекомендуется: ${posName}` : posName}{schoolName ? ` · ${schoolName}` : ""} · {typeName} · {new Date(item.created_at).toLocaleDateString("ru-RU")} · {item.fit}%
              </div>
              {top3.length > 0 && (
                <div style={{ fontSize: 13, color: "#44413B", marginTop: 4 }}>Топ-3: {top3.join(", ")}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
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
            </div>
          </div>
        );
      })}
    </div></div>
  );
}
