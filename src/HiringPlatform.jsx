import { useEffect, useMemo, useState } from "react";
import { COMPETENCIES, getJobProfile, JOB_PROFILES, PROFILE_STATUS } from "./hiring/jobProfiles";
import { calculateAssessment, createCandidateRecord } from "./hiring/assessmentEngine";
import { configureValidationCalculator, summarizeValidation } from "./hiring/validationMetrics";
import { createAssessment, createCandidateInvite, createCustomProfile, deleteAssessment, getMembership, getSessionUser, listAssessments, listCustomProfiles, listLegacyResults, saveAssessment, saveOutcome, signIn, signOut } from "./hiring/secureRepository";
import "./hiring/hiring.css";

configureValidationCalculator(calculateAssessment);

function Rating({ value, onChange, label }) {
  return <div className="eh-rating" role="group" aria-label={label}>
    {[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" aria-pressed={value === score} onClick={() => onChange(score)}>{score}</button>)}
  </div>;
}

function Login({ onReady, onDemo }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try { const user = await signIn(form.email, form.password); await onReady(user); }
    catch (reason) { setError(reason?.message || "Не удалось войти"); }
    finally { setLoading(false); }
  };
  return <div className="eh-shell"><main className="eh-main" style={{ maxWidth: 520 }}>
    <div className="eh-brand" style={{ margin: "30px 0 24px" }}><span className="eh-brand-mark">E</span><span>EvidenceHire</span></div>
    <form className="eh-panel" onSubmit={submit}>
      <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Защищённый доступ</p><h1 style={{ marginTop: 0 }}>Вход для команды найма</h1>
      <p style={{ color: "#647068", lineHeight: 1.55 }}>Данные кандидатов доступны только участникам вашей организации через Supabase Auth и политики RLS.</p>
      <label className="eh-label" htmlFor="auth-email">Рабочий email</label><input id="auth-email" className="eh-input" type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <label className="eh-label" htmlFor="auth-password" style={{ marginTop: 14 }}>Пароль</label><input id="auth-password" className="eh-input" type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      {error && <div role="alert" className="eh-callout" style={{ marginTop: 14 }}>{error}</div>}
      <button className="eh-btn eh-btn-primary" disabled={loading} style={{ width: "100%", marginTop: 18 }} type="submit">{loading ? "Входим…" : "Войти"}</button>
      <button className="eh-btn eh-btn-ghost" style={{ width: "100%", marginTop: 10 }} type="button" onClick={onDemo}>Открыть демонстрацию без сохранения данных</button>
      <p className="eh-helper" style={{ marginTop: 12 }}>Демонстрация работает только в текущей вкладке. Не вводите реальные персональные данные.</p>
    </form>
  </main></div>;
}

function Header({ view, setView, account, onSignOut }) {
  return <header className="eh-header">
    <div className="eh-header-inner">
      <div className="eh-brand"><span className="eh-brand-mark">E</span><span>EvidenceHire</span></div>
      <nav className="eh-nav" aria-label="Основная навигация">
        <button type="button" aria-current={view === "profiles" ? "page" : undefined} onClick={() => setView("profiles")}>Должности</button>
        <button type="button" aria-current={view === "candidates" ? "page" : undefined} onClick={() => setView("candidates")}>Кандидаты</button>
        <button type="button" aria-current={view === "legacy" ? "page" : undefined} onClick={() => setView("legacy")}>Архив тестов</button>
        <button type="button" aria-current={view === "method" ? "page" : undefined} onClick={() => setView("method")}>Методика</button>
        <button type="button" aria-current={view === "research" ? "page" : undefined} onClick={() => setView("research")}>Исследования</button>
        {account && <button type="button" onClick={onSignOut}>Выйти</button>}
      </nav>
    </div>
  </header>;
}

function Profiles({ profiles, onSelect, onCreateCustom }) {
  const [search, setSearch] = useState("");
  const filtered = profiles.filter((profile) => `${profile.name} ${profile.family} ${profile.summary}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <section className="eh-hero">
      <div className="eh-hero-copy">
        <p className="eh-kicker">Структурированная оценка</p>
        <h1>Нанимайте по рабочим доказательствам, а не по впечатлению</h1>
        <p>Для каждой должности — конкретная рабочая проба, одинаковые вопросы интервью и прозрачные поведенческие критерии.</p>
      </div>
      <aside className="eh-hero-side" aria-label="Принципы оценки">
        <h2>Что делает оценку сильнее</h2>
        <div className="eh-proof-list">
          <div className="eh-proof"><span>1</span><div><strong>Связь с работой</strong><br />Оцениваем поведение, необходимое в конкретной роли.</div></div>
          <div className="eh-proof"><span>2</span><div><strong>Одинаковые условия</strong><br />Вопросы, порядок и шкалы фиксируются заранее.</div></div>
          <div className="eh-proof"><span>3</span><div><strong>Несколько источников</strong><br />Рабочая проба и интервью показываются раздельно.</div></div>
        </div>
      </aside>
    </section>
    <div className="eh-toolbar">
      <div><h2>Профили должностей</h2><p>{profiles.length} профилей для разных отраслей</p></div>
      <div className="eh-actions"><button type="button" className="eh-btn eh-btn-primary" onClick={onCreateCustom}>Создать профиль</button><div className="eh-search"><label className="eh-label" htmlFor="role-search">Найти должность</label><input id="role-search" className="eh-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например, аналитик" /></div></div>
    </div>
    <div className="eh-grid">
      {filtered.map((profile) => <button className="eh-profile-card" key={profile.id} type="button" onClick={() => onSelect(profile)}>
        <div className="eh-profile-top"><span className="eh-family">{profile.family}</span><span className="eh-status">{PROFILE_STATUS[profile.status]}</span></div>
        <h3>{profile.name}</h3><p>{profile.summary}</p>
        <div className="eh-card-meta"><span className="eh-chip">Рабочая проба</span><span className="eh-chip">{profile.interview.length} вопроса интервью</span><span className="eh-chip">{Object.keys(profile.competencies).length} компетенций</span></div>
      </button>)}
    </div>
  </>;
}

const GENERIC_ANCHORS = {
  1: "Нет конкретного примера, действий кандидата или проверяемого результата.",
  3: "Есть релевантный пример, понятные действия и приемлемый рабочий результат.",
  5: "Пример сложный и релевантный; действия осознанны, результат измерим, кандидат показывает выводы и границы своего вклада.",
};

function ProfileBuilder({ onCancel, onCreate }) {
  const competencyIds = Object.keys(COMPETENCIES);
  const [form, setForm] = useState({ name: "", family: "", summary: "", prompt: "", selected: ["results", "ownership", "problemSolving"] });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const toggle = (id) => setForm((state) => ({ ...state, selected: state.selected.includes(id) ? state.selected.filter((item) => item !== id) : [...state.selected, id] }));
  const submit = async () => {
    if (!form.name.trim() || !form.family.trim() || !form.prompt.trim() || form.selected.length < 3) { setError("Заполните название, семейство, рабочую пробу и выберите минимум три компетенции."); return; }
    const weight = Math.floor(100 / form.selected.length); const competencies = {};
    form.selected.forEach((id, index) => { competencies[id] = index === form.selected.length - 1 ? 100 - weight * (form.selected.length - 1) : weight; });
    const id = `custom-${form.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const profile = {
      id, version: 1, status: "draft", name: form.name.trim(), family: form.family.trim(), summary: form.summary.trim() || "Пользовательский профиль должности.", competencies,
      interview: form.selected.slice(0, 4).map((competency) => ({ id: `${id}-${competency}`, competency, text: `Расскажите о конкретной рабочей ситуации, в которой особенно требовалась компетенция «${COMPETENCIES[competency].name}». Какова была ваша роль, что вы сделали и как измерили результат?`, anchors: GENERIC_ANCHORS })),
      workSample: { title: "Рабочая проба", prompt: form.prompt.trim(), minutes: 40, rubric: form.selected.slice(0, 4).map((competency) => ({ competency, criterion: COMPETENCIES[competency].name, anchors: GENERIC_ANCHORS })) },
    };
    setSaving(true); setError(""); try { await onCreate(profile); } catch (reason) { setError(reason?.message || "Не удалось сохранить профиль"); } finally { setSaving(false); }
  };
  return <div className="eh-panel">
    <div className="eh-role-head"><div><span className="eh-family">Анализ работы</span><h1>Новый профиль должности</h1><p>Создайте черновик, затем проверьте задачи и критерии с руководителем и сильными сотрудниками этой роли.</p></div><span className="eh-status">Черновик</span></div>
    <div className="eh-callout">Автоматически созданные вопросы являются отправной точкой. До применения для отбора проведите экспертную сессию и замените общие якоря наблюдаемыми примерами именно этой работы.</div>
    <div className="eh-form-grid" style={{ marginTop: 20 }}>
      <div><label className="eh-label" htmlFor="profile-name">Название должности</label><input id="profile-name" className="eh-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="profile-family">Семейство или направление</label><input id="profile-family" className="eh-input" value={form.family} onChange={(event) => setForm({ ...form, family: event.target.value })} placeholder="Финансы, производство, медицина…" /></div>
      <div className="eh-form-field-full"><label className="eh-label" htmlFor="profile-summary">Главный рабочий результат</label><textarea id="profile-summary" className="eh-textarea" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Что эта должность должна создавать для организации или клиента?" /></div>
      <div className="eh-form-field-full"><label className="eh-label" htmlFor="profile-sample">Репрезентативная рабочая задача</label><textarea id="profile-sample" className="eh-textarea" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="Опишите короткую задачу, близкую к реальной работе, без использования конфиденциальных данных." /></div>
    </div>
    <h2 style={{ marginTop: 24 }}>Критичные компетенции</h2><p className="eh-helper">Выберите 3–7 компетенций. Чем короче список, тем качественнее их можно проверить.</p>
    <div className="eh-grid" style={{ marginTop: 12 }}>{competencyIds.map((id) => <label key={id} className="eh-profile-card" style={{ minHeight: 130, cursor: "pointer", borderColor: form.selected.includes(id) ? "#1f6f4e" : undefined }}><input type="checkbox" checked={form.selected.includes(id)} onChange={() => toggle(id)} /><h3 style={{ marginTop: 10 }}>{COMPETENCIES[id].name}</h3><p>{COMPETENCIES[id].description}</p></label>)}</div>
    {error && <div role="alert" className="eh-callout" style={{ marginTop: 16 }}>{error}</div>}
    <div className="eh-actions" style={{ marginTop: 20 }}><button type="button" className="eh-btn eh-btn-primary" disabled={saving} onClick={submit}>{saving ? "Сохраняем…" : "Создать черновик"}</button><button type="button" className="eh-btn eh-btn-ghost" onClick={onCancel}>Отмена</button></div>
  </div>;
}

function CandidateForm({ profile, onCancel, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const create = async () => { setSubmitting(true); setError(""); try { await onCreate(createCandidateRecord({ ...form, profileId: profile.id })); } catch (reason) { setError(reason?.message || "Не удалось создать оценку"); } finally { setSubmitting(false); } };
  return <div className="eh-panel">
    <div className="eh-role-head"><div><span className="eh-family">{profile.family}</span><h1>{profile.name}</h1><p>{profile.summary}</p></div><span className="eh-status">{PROFILE_STATUS[profile.status]}</span></div>
    <div className="eh-callout">Профиль находится на стадии экспертной проверки. Используйте баллы для единообразного сбора данных, но не как автоматический отсев до локального исследования валидности.</div>
    <h2 style={{ marginTop: 26 }}>Новая оценка</h2>
    <div className="eh-form-grid">
      <div><label className="eh-label" htmlFor="candidate-name">Имя кандидата</label><input id="candidate-name" className="eh-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></div>
      <div><label className="eh-label" htmlFor="candidate-email">Email — необязательно</label><input id="candidate-email" className="eh-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" autoComplete="email" /></div>
      <div className="eh-form-field-full"><p className="eh-helper">Не собирайте возраст, пол, семейное положение и другие данные, не связанные с выполнением работы. Перед отправкой заданий получите согласие на обработку контактных данных.</p></div>
    </div>
    {error && <div role="alert" className="eh-callout" style={{ marginTop: 16 }}>{error}</div>}
    <div className="eh-actions" style={{ marginTop: 22 }}><button className="eh-btn eh-btn-primary" type="button" disabled={!form.name.trim() || submitting} onClick={create}>{submitting ? "Создаём…" : "Создать оценку"}</button><button className="eh-btn eh-btn-ghost" type="button" onClick={onCancel}>Отмена</button></div>
  </div>;
}

function Stage({ index, title, subtitle, open, onToggle, children }) {
  return <section className="eh-stage">
    <button type="button" className="eh-stage-summary" aria-expanded={open} onClick={onToggle}><span className="eh-stage-index">{index}</span><span className="eh-stage-title"><h3>{title}</h3><p>{subtitle}</p></span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <div className="eh-stage-body">{children}</div>}
  </section>;
}

function Scorecard({ candidate, profile }) {
  const result = calculateAssessment(profile, candidate.interviewRatings, candidate.workSampleRatings);
  return <aside className="eh-panel eh-score-card">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Сводка доказательств</p>
    <div className="eh-score-number" style={{ "--score": `${result.overall || 0}%` }}><strong>{result.overall == null ? "—" : result.overall}</strong></div>
    <div className="eh-score-decision">{result.decision}</div>
    <div className="eh-progress-line"><div className="eh-progress-track"><span style={{ width: `${result.completion}%` }} /></div><div className="eh-progress-label"><span>Покрытие компетенций</span><strong>{result.completion}%</strong></div></div>
    <div className="eh-competencies">
      {result.competencyScores.map((row) => <div className="eh-competency" key={row.id}><span>{COMPETENCIES[row.id]?.name || row.id}</span><strong>{row.score == null ? "Нет данных" : row.score.toFixed(1)}</strong><small>Вес {row.weight}% · доказательств {row.evidenceCount}</small></div>)}
    </div>
    <p className="eh-helper" style={{ marginTop: 18 }}>Итог отображается только при достаточном покрытии. Рабочая проба получает больший вес, чем самоописание или общее впечатление.</p>
  </aside>;
}

function Assessment({ candidate, profile, onChange, onBack, onDelete, onSave, onSaveOutcome, onCreateInvite, saveState, canManageOutcomes, canDelete, canDecide, demo }) {
  const [open, setOpen] = useState({ sample: true, interview: false, decision: false, outcome: false });
  const [inviteState, setInviteState] = useState("");
  const setRating = (field, id, value) => onChange({ ...candidate, [field]: { ...candidate[field], [id]: value } });
  return <>
    <button type="button" className="eh-btn eh-btn-ghost eh-back" onClick={onBack}>← К кандидатам</button>
    <div className="eh-role-head"><div><span className="eh-family">{profile.family}</span><h1>{candidate.name}</h1><p>{profile.name} · оценка создана {new Date(candidate.createdAt).toLocaleDateString("ru-RU")}</p></div><div className="eh-actions"><button type="button" className="eh-btn eh-btn-ghost eh-print-button" onClick={() => { setOpen({ sample: true, interview: true, decision: true, outcome: true }); setTimeout(() => window.print(), 50); }}>Печать</button><button type="button" className="eh-btn eh-btn-secondary" disabled={demo || inviteState === "loading"} onClick={async () => { setInviteState("loading"); try { const link = await onCreateInvite(); await navigator.clipboard.writeText(link); setInviteState("copied"); } catch { setInviteState("error"); } }}>Ссылка кандидату</button><button type="button" className="eh-btn eh-btn-primary" disabled={saveState === "saving"} onClick={onSave}>{saveState === "saving" ? "Сохраняем…" : saveState === "saved" ? "Сохранено ✓" : "Сохранить"}</button>{canDelete && <button type="button" className="eh-btn eh-btn-danger" onClick={onDelete}>Удалить</button>}</div></div>
    {inviteState === "copied" && <div role="status" className="eh-callout" style={{ marginBottom: 16 }}>Одноразовая ссылка действует 7 дней и скопирована в буфер обмена.</div>}
    {inviteState === "error" && <div role="alert" className="eh-callout" style={{ marginBottom: 16 }}>Не удалось создать ссылку кандидату.</div>}
    {demo && <p className="eh-helper" style={{ marginTop: -12, marginBottom: 16 }}>Защищённые ссылки доступны после входа и применения целевой схемы базы данных.</p>}
    {saveState === "error" && <div role="alert" className="eh-callout" style={{ marginBottom: 16 }}>Не удалось сохранить изменения. Проверьте соединение и права доступа.</div>}
    <div className="eh-score-layout">
      <div className="eh-stack">
        <Stage index="1" title={profile.workSample.title} subtitle={`Рабочая проба · около ${profile.workSample.minutes} минут`} open={open.sample} onToggle={() => setOpen({ ...open, sample: !open.sample })}>
          <div className="eh-work-prompt">{profile.workSample.prompt}</div>
          <label className="eh-label" htmlFor="sample-notes">Ответ кандидата или ссылка на работу</label><textarea id="sample-notes" className="eh-textarea" value={candidate.workSampleNotes} onChange={(event) => onChange({ ...candidate, workSampleNotes: event.target.value })} placeholder="Зафиксируйте ответ дословно или добавьте ссылку. Сначала сохраните работу, затем выставляйте оценки." />
          {profile.workSample.rubric.map((item, index) => { const id = `${profile.id}-rubric-${index}`; return <div className="eh-question" key={id}><span className="eh-question-meta">{COMPETENCIES[item.competency]?.name}</span><h4>{item.criterion}</h4><div className="eh-anchor-grid">{[1,3,5].map((score) => <div className="eh-anchor" key={score}><strong>{score}</strong> · {item.anchors[score]}</div>)}</div><Rating label={`Оценка: ${item.criterion}`} value={candidate.workSampleRatings[id]} onChange={(value) => setRating("workSampleRatings", id, value)} /></div>; })}
        </Stage>
        <Stage index="2" title="Структурированное интервью" subtitle="Одинаковые вопросы и критерии для всех кандидатов" open={open.interview} onToggle={() => setOpen({ ...open, interview: !open.interview })}>
          {profile.interview.map((question) => <div className="eh-question" key={question.id}><span className="eh-question-meta">{COMPETENCIES[question.competency]?.name}</span><h4>{question.text}</h4><label className="eh-label" htmlFor={`note-${question.id}`}>Факты из ответа</label><textarea id={`note-${question.id}`} className="eh-textarea" value={candidate.interviewNotes[question.id] || ""} onChange={(event) => onChange({ ...candidate, interviewNotes: { ...candidate.interviewNotes, [question.id]: event.target.value } })} placeholder="Контекст, действия кандидата, измеримый результат и уточняющие факты" /><div className="eh-anchor-grid">{[1,3,5].map((score) => <div className="eh-anchor" key={score}><strong>{score}</strong> · {question.anchors[score]}</div>)}</div><Rating label={`Оценка ответа на вопрос: ${question.text}`} value={candidate.interviewRatings[question.id]} onChange={(value) => setRating("interviewRatings", question.id, value)} /></div>)}
        </Stage>
        <Stage index="3" title="Решение комиссии" subtitle="Фиксируется после независимых оценок" open={open.decision} onToggle={() => setOpen({ ...open, decision: !open.decision })}>
          <div className="eh-callout">До обсуждения каждый интервьюер должен независимо выставить оценки. Разногласие в два и более балла разбирается по фактам ответа, а не усредняется автоматически.</div>
          <div className="eh-form-grid" style={{ marginTop: 16 }}><div><label className="eh-label" htmlFor="decision">Решение</label><select id="decision" className="eh-select" disabled={!canDecide} value={candidate.finalDecision || "pending"} onChange={(event) => onChange({ ...candidate, finalDecision: event.target.value })}><option value="pending">Не принято</option><option value="next">Следующий этап</option><option value="offer">Оффер</option><option value="reserve">Кадровый резерв</option><option value="decline">Отказ</option></select></div><div><label className="eh-label" htmlFor="decision-reason">Обоснование по критериям роли</label><textarea id="decision-reason" className="eh-textarea" disabled={!canDecide} value={candidate.decisionReason || ""} onChange={(event) => onChange({ ...candidate, decisionReason: event.target.value })} /></div></div>
          {!canDecide && <p className="eh-helper">Финальное решение фиксирует владелец или администратор после независимых оценок комиссии.</p>}
        </Stage>
        <Stage index="4" title="Проверка прогноза" subtitle="Фактические KPI через 30, 60 и 90 дней" open={open.outcome} onToggle={() => setOpen({ ...open, outcome: !open.outcome })}>
          <div className="eh-callout">Эти данные не должны быть видны интервьюерам до завершения оценки. Используйте один и тот же заранее определённый KPI для сотрудников одной должности.</div>
          {[30, 60, 90].map((days) => { const value = candidate.outcomes?.[days] || { retained: "", managerRating: "", kpiValue: "", kpiDefinition: "", notes: "" }; const update = (patch) => onChange({ ...candidate, outcomes: { ...(candidate.outcomes || {}), [days]: { ...value, ...patch } } }); return <div className="eh-question" key={days}>
            <h4>{days}-й день</h4><div className="eh-form-grid">
              <div><label className="eh-label" htmlFor={`retained-${days}`}>Продолжает работу</label><select id={`retained-${days}`} className="eh-select" disabled={!canManageOutcomes} value={value.retained} onChange={(event) => update({ retained: event.target.value })}><option value="">Нет данных</option><option value="true">Да</option><option value="false">Нет</option></select></div>
              <div><label className="eh-label" htmlFor={`manager-${days}`}>Оценка руководителя 1–5</label><select id={`manager-${days}`} className="eh-select" disabled={!canManageOutcomes} value={value.managerRating} onChange={(event) => update({ managerRating: event.target.value })}><option value="">Нет данных</option>{[1,2,3,4,5].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><label className="eh-label" htmlFor={`kpi-${days}`}>Значение KPI</label><input id={`kpi-${days}`} className="eh-input" type="number" disabled={!canManageOutcomes} value={value.kpiValue} onChange={(event) => update({ kpiValue: event.target.value })} /></div>
              <div><label className="eh-label" htmlFor={`kpi-def-${days}`}>Определение KPI</label><input id={`kpi-def-${days}`} className="eh-input" disabled={!canManageOutcomes} value={value.kpiDefinition} onChange={(event) => update({ kpiDefinition: event.target.value })} placeholder="Например, % выполнения плана" /></div>
              <div className="eh-form-field-full"><label className="eh-label" htmlFor={`outcome-note-${days}`}>Комментарий</label><textarea id={`outcome-note-${days}`} className="eh-textarea" disabled={!canManageOutcomes} value={value.notes} onChange={(event) => update({ notes: event.target.value })} /></div>
            </div>{canManageOutcomes && <button type="button" className="eh-btn eh-btn-secondary" onClick={() => onSaveOutcome(days, value)}>Сохранить данные {days}-го дня</button>}
          </div>; })}
          {!canManageOutcomes && <p className="eh-helper">Изменять исходы могут только владелец или администратор организации.</p>}
        </Stage>
      </div>
      <Scorecard candidate={candidate} profile={profile} />
    </div>
  </>;
}

function Candidates({ candidates, onOpen, onNew, resolveProfile }) {
  return <>
    <div className="eh-toolbar"><div><h2>Кандидаты</h2><p>Единый реестр структурированных оценок</p></div><button type="button" className="eh-btn eh-btn-primary" onClick={onNew}>Новая оценка</button></div>
    {!candidates.length ? <div className="eh-empty"><h3>Оценок пока нет</h3><p>Выберите профиль должности и создайте первую оценку кандидата.</p><button type="button" className="eh-btn eh-btn-primary" onClick={onNew}>Выбрать должность</button></div> : <div className="eh-candidates">{candidates.map((candidate) => { const profile = resolveProfile(candidate.profileId); const result = calculateAssessment(profile, candidate.interviewRatings, candidate.workSampleRatings); return <article className="eh-candidate" key={candidate.id}><div><h3>{candidate.name}</h3><p>{profile.name} · покрытие {result.completion}% · {result.decision}</p></div><button type="button" className="eh-btn eh-btn-secondary" onClick={() => onOpen(candidate)}>Открыть оценку</button></article>; })}</div>}
  </>;
}

const LEGACY_FIELDS = [
  ["candidate_email", "Email"], ["candidate_phone", "Телефон"], ["candidate_city", "Город"],
  ["position_name", "Должность"], ["recommended_position", "Рекомендованная роль"],
  ["total_score", "Итоговый балл"], ["score", "Балл"], ["level", "Уровень"],
];

function LegacyArchive({ archive }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  if (archive.loading) return <div className="eh-empty">Загружаем прежние результаты…</div>;
  if (archive.error) return <div className="eh-panel"><h2>Не удалось открыть архив</h2><p>{archive.error}</p><p className="eh-helper">Проверьте SUPABASE_SERVICE_ROLE_KEY в Vercel. Старые данные остаются в базе и доступны в прежнем кабинете.</p></div>;
  const query = search.trim().toLowerCase();
  const items = archive.items.filter((item) => (type === "all" || item.type === type) && (!query || `${item.candidateName} ${item.email} ${item.phone} ${item.label}`.toLowerCase().includes(query)));
  const types = [...new Map(archive.items.map((item) => [item.type, item.label])).entries()];
  return <>
    <div className="eh-toolbar"><div><h2>Архив прежних тестов</h2><p>{archive.items.length} сохранённых результатов · только чтение</p></div><div className="eh-actions"><div className="eh-search"><label className="eh-label" htmlFor="legacy-search">Найти кандидата</label><input id="legacy-search" className="eh-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, email или телефон" /></div><div><label className="eh-label" htmlFor="legacy-type">Методика</label><select id="legacy-type" className="eh-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Все методики</option>{types.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></div></div>
    <div className="eh-callout" style={{ marginBottom: 18 }}>Старые результаты показаны отдельно и не входят автоматически в новый итоговый балл: для них использовались другие вопросы, шкалы и правила интерпретации.</div>
    {archive.warnings.length > 0 && <div className="eh-callout" style={{ marginBottom: 18 }}>Часть таблиц временно недоступна: {archive.warnings.map((item) => item.table).join(", ")}.</div>}
    {!items.length ? <div className="eh-empty"><h3>Ничего не найдено</h3><p>Измените поиск или фильтр методики.</p></div> : <div className="eh-candidates">{items.map((item) => {
      const visibleFields = LEGACY_FIELDS.map(([key, label]) => [label, item.raw?.[key]]).filter(([, value]) => value !== null && value !== undefined && value !== "");
      const report = item.raw?.report || item.raw?.summary || item.raw?.analysis || item.raw?.recommendation || "";
      return <article className="eh-candidate" key={item.id} style={{ alignItems: "flex-start" }}><div style={{ minWidth: 0, width: "100%" }}><span className="eh-family">{item.label}</span><h3 style={{ marginTop: 8 }}>{item.candidateName}</h3><p>{item.createdAt ? new Date(item.createdAt).toLocaleString("ru-RU") : "Дата не указана"}{item.email ? ` · ${item.email}` : ""}{item.phone ? ` · ${item.phone}` : ""}</p>{visibleFields.length > 0 && <div className="eh-card-meta">{visibleFields.map(([label, value]) => <span className="eh-chip" key={label}>{label}: {String(value)}</span>)}</div>}<details style={{ marginTop: 14 }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Сохранённый результат</summary><pre className="eh-legacy-report">{report ? (typeof report === "string" ? report : JSON.stringify(report, null, 2)) : JSON.stringify(item.raw, null, 2)}</pre></details></div></article>;
    })}</div>}
  </>;
}

function Method() {
  return <article className="eh-method">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Стандарт EvidenceHire</p><h1>Как система поддерживает обоснованный найм</h1>
    <div className="eh-callout">Платформа стандартизирует процесс, но валидность должна подтверждаться для конкретной должности, организации и способа использования. Название метода или его популярность не являются доказательством.</div>
    <section><h2>1. Анализ работы</h2><p>До оценки фиксируются критичные задачи, рабочие продукты, последствия ошибки и требования, необходимые именно на входе. Профиль пересматривается при существенном изменении роли.</p></section>
    <section><h2>2. Репрезентативная рабочая проба</h2><p>Кандидат выполняет задачу, близкую к реальной работе. Проверяющий использует заранее заданную рубрику и не подменяет качество решения общим впечатлением.</p></section>
    <section><h2>3. Структурированное интервью</h2><p>Основные вопросы и порядок одинаковы для всех кандидатов на должность. Оценка 1–5 привязывается к наблюдаемым признакам ответа. Дополнительные вопросы разрешены только для уточнения фактов.</p></section>
    <section><h2>4. Независимые оценки</h2><p>Интервьюеры сначала оценивают кандидата самостоятельно. Комиссия обсуждает факты при расхождении, а не ищет компромиссный балл.</p></section>
    <section><h2>5. Локальная проверка</h2><p>Система должна связывать оценки с заранее определёнными KPI через 30, 60 и 90 дней, проверять надёжность шкал, согласие оценщиков и различия в прохождении этапов.</p></section>
    <section><h2>Ограничения</h2><ul><li>Не используйте личностные ярлыки или выводы о здоровье.</li><li>Не ранжируйте людей по неподтверждённым порогам.</li><li>Не собирайте признаки, не связанные с работой.</li><li>Не раскрывайте предыдущие оценки интервьюеру до независимого выставления баллов.</li></ul></section>
  </article>;
}

function Research({ candidates, resolveProfile }) {
  const summary = summarizeValidation(candidates, resolveProfile, 90);
  const readinessText = summary.readiness === "insufficient" ? "Недостаточно данных" : summary.readiness === "pilot" ? "Пилотная выборка" : "Достаточно для основного исследования";
  return <article className="eh-method">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Локальная валидизация</p><h1>Проверка связи оценки с реальной работой</h1>
    <div className="eh-callout">Корреляция не доказывает причинность. Не меняйте веса и пороги после каждого нового сотрудника: заранее зафиксируйте план анализа и проводите пересмотр версиями.</div>
    <div className="eh-grid" style={{ marginTop: 20 }}>
      <div className="eh-panel"><span className="eh-family">Все оценки</span><h2 style={{ fontSize: 38, marginBottom: 4 }}>{summary.totalCandidates}</h2><p className="eh-helper">Создано в организации</p></div>
      <div className="eh-panel"><span className="eh-family">90 дней</span><h2 style={{ fontSize: 38, marginBottom: 4 }}>{summary.followedUp}</h2><p className="eh-helper">Есть данные последующего наблюдения</p></div>
      <div className="eh-panel"><span className="eh-family">Выборка анализа</span><h2 style={{ fontSize: 38, marginBottom: 4 }}>{summary.usable}</h2><p className="eh-helper">Есть полная оценка и рейтинг руководителя</p></div>
    </div>
    <section><h2>{readinessText}</h2><p>До 30 сопоставимых наблюдений нельзя рассчитывать устойчивые локальные коэффициенты. На 30–99 результат следует считать пилотным. Для разных должностей анализ проводится отдельно, если нет обоснования их объединения.</p></section>
    <section><h2>Текущий сигнал</h2><p>{summary.correlation == null ? "Корреляция пока не рассчитывается: требуется минимум три непостоянных пары, а для практических выводов — существенно больше." : `Наблюдаемая корреляция общего балла с оценкой руководителя: ${summary.correlation.toFixed(2)}. Интерпретируйте её только вместе с размером выборки и доверительным интервалом.`}</p></section>
    <section><h2>Перед подтверждением профиля</h2><ul><li>Зафиксируйте KPI и период до просмотра результатов.</li><li>Проверьте согласие оценщиков и качество заполнения рубрик.</li><li>Оцените добавочную пользу каждого этапа.</li><li>Проверьте различия в прохождении этапов и альтернативы с меньшим неблагоприятным воздействием.</li><li>Документируйте область применения и новую версию профиля.</li></ul></section>
  </article>;
}

export default function HiringPlatform() {
  const [auth, setAuth] = useState({ loading: true, user: null, membership: null, demo: false, error: "" });
  const [view, setView] = useState("profiles");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [customProfiles, setCustomProfiles] = useState([]);
  const [candidate, setCandidate] = useState(null);
  // Демонстрационный режим намеренно не сохраняет персональные данные в браузере.
  // Production-хранилище подключается через evidence_hiring_schema.sql и Supabase Auth.
  const [candidates, setCandidates] = useState([]);
  const [legacyArchive, setLegacyArchive] = useState({ loading: true, items: [], warnings: [], error: "" });
  const [saveState, setSaveState] = useState("idle");

  const loadAccount = async (user) => {
    const membership = await getMembership(user.id);
    if (!membership) throw new Error("Для пользователя не настроено членство в организации. Добавьте запись organization_members.");
    const [items, custom, legacy] = await Promise.all([
      listAssessments(membership.organization_id, user.id),
      listCustomProfiles(membership.organization_id),
      ["owner", "admin"].includes(membership.role)
        ? listLegacyResults().catch((reason) => ({ items: [], warnings: [], error: reason?.message || "Ошибка архива" }))
        : Promise.resolve({ items: [], warnings: [], error: "Архив доступен владельцу и администратору" }),
    ]);
    setCandidates(items);
    setCustomProfiles(custom);
    setLegacyArchive({ loading: false, items: legacy.items || [], warnings: legacy.warnings || [], error: legacy.error || "" });
    setAuth({ loading: false, user, membership, demo: false, error: "" });
  };

  useEffect(() => {
    getSessionUser().then((user) => user ? loadAccount(user) : setAuth((state) => ({ ...state, loading: false })))
      .catch((reason) => setAuth({ loading: false, user: null, membership: null, demo: false, error: reason?.message || "Ошибка подключения" }));
  }, []);
  useEffect(() => {
    if (saveState !== "dirty") return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);
  const profiles = useMemo(() => [...customProfiles, ...JOB_PROFILES], [customProfiles]);
  const resolveProfile = (id) => profiles.find((item) => item.id === id) || getJobProfile(id);
  const profile = candidate ? resolveProfile(candidate.profileId) : selectedProfile;
  const updateCandidate = (next) => { setSaveState("dirty"); setCandidate(next); setCandidates((items) => items.map((item) => item.id === next.id ? next : item)); };
  const navigate = (next) => {
    if (candidate && saveState === "dirty" && !window.confirm("Есть несохранённые изменения. Покинуть оценку?")) return;
    setSaveState("idle"); setView(next); setSelectedProfile(null); setCandidate(null); setBuildingProfile(false); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  let content;
  if (auth.loading) return <div className="eh-shell"><main className="eh-main"><div className="eh-empty">Проверяем защищённую сессию…</div></main></div>;
  if (!auth.user && !auth.demo) return <Login onReady={loadAccount} onDemo={() => setAuth({ loading: false, user: null, membership: null, demo: true, error: "" })} />;

  const persistCandidate = async () => {
    if (auth.demo) { setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1200); return; }
    setSaveState("saving");
    try { await saveAssessment(auth.membership.organization_id, auth.user.id, candidate); setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1500); }
    catch { setSaveState("error"); }
  };

  if (candidate && profile) content = <Assessment candidate={candidate} profile={profile} onChange={updateCandidate} onBack={() => navigate("candidates")} onSave={persistCandidate} saveState={saveState} demo={auth.demo} onCreateInvite={() => createCandidateInvite(candidate.id)} canManageOutcomes={auth.demo || ["owner","admin"].includes(auth.membership?.role)} canDelete={auth.demo || ["owner","admin"].includes(auth.membership?.role)} canDecide={auth.demo || ["owner","admin"].includes(auth.membership?.role)} onSaveOutcome={async (days, outcome) => { if (auth.demo) { setSaveState("saved"); return; } setSaveState("saving"); try { await saveOutcome(auth.membership.organization_id, auth.user.id, candidate.id, days, outcome); setSaveState("saved"); } catch { setSaveState("error"); } }} onDelete={async () => { if (!window.confirm("Удалить оценку кандидата?")) return; try { if (!auth.demo) await deleteAssessment(auth.membership.organization_id, candidate); setCandidates((items) => items.filter((item) => item.id !== candidate.id)); setSaveState("idle"); setCandidate(null); setView("candidates"); } catch { setSaveState("error"); } }} />;
  else if (buildingProfile) content = <ProfileBuilder onCancel={() => setBuildingProfile(false)} onCreate={async (created) => { if (!auth.demo) await createCustomProfile(auth.membership.organization_id, auth.user.id, created); setCustomProfiles((items) => [created, ...items]); setBuildingProfile(false); setSelectedProfile(created); }} />;
  else if (selectedProfile) content = <CandidateForm profile={selectedProfile} onCancel={() => setSelectedProfile(null)} onCreate={async (created) => { const stored = auth.demo ? created : await createAssessment(auth.membership.organization_id, auth.user.id, created); setCandidates((items) => [stored, ...items]); setCandidate(stored); }} />;
  else if (view === "candidates") content = <Candidates candidates={candidates} onOpen={setCandidate} onNew={() => navigate("profiles")} resolveProfile={resolveProfile} />;
  else if (view === "legacy") content = <LegacyArchive archive={legacyArchive} />;
  else if (view === "method") content = <Method />;
  else if (view === "research") content = <Research candidates={candidates} resolveProfile={resolveProfile} />;
  else content = <Profiles profiles={profiles} onSelect={setSelectedProfile} onCreateCustom={() => setBuildingProfile(true)} />;

  return <div className="eh-shell"><Header view={view} setView={navigate} account={auth.user} onSignOut={async () => { await signOut(); setCandidates([]); setAuth({ loading: false, user: null, membership: null, demo: false, error: "" }); }} /><main className="eh-main">{auth.demo && <div className="eh-callout" style={{ marginBottom: 18 }}>Демонстрационный режим: данные существуют только в текущей вкладке и исчезнут после обновления.</div>}{content}</main></div>;
}
