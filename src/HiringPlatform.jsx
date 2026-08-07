import { useEffect, useMemo, useRef, useState } from "react";
import { COMPETENCIES, getJobProfile, JOB_PROFILES, PROFILE_STATUS } from "./hiring/jobProfiles";
import { assessmentAccessState, buildDecisionMatrix, calculateAssessment, canCompareCandidates, createCandidateRecord, decisionReadiness, documentedEvidenceStatus } from "./hiring/assessmentEngine";
import { buildVerificationGuidance } from "./hiring/hrGuidance";
import { parseReferenceCheck, referenceDispositionComplete, serializeReferenceCheck } from "./hiring/referenceCheck";
import { refreshCanApply, saveCardThenOutcomes } from "./hiring/saveCoordination";
import { configureValidationCalculator, summarizeValidation } from "./hiring/validationMetrics";
import { buildWorkPreferenceMap, WORK_PREFERENCE_MODULE } from "./hiring/workPreferenceMap";
import { addCandidateNote, archiveAssessment, createAssessment, createCandidateInvite, getLegacyResultDetail, getMembership, getSessionUser, listAssessments, listCustomProfiles, listLegacyResults, promoteProfileToPilot, restoreAssessment, saveAssessment, saveOutcome, setAssessmentCandidateModules, signIn, signOut, submitAssessmentEvidence } from "./hiring/secureRepository";
import { branchById, BRANCHES } from "./org";
import "./hiring/hiring.css";

configureValidationCalculator(calculateAssessment);

function Rating({ value, onChange, label, disabled = false }) {
  return <div className="eh-rating" role="group" aria-label={label}>
    {[1, 3, 5].map((score) => <button key={score} type="button" disabled={disabled} aria-pressed={value === score} onClick={() => onChange(score)}>{score}</button>)}
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

function Header({ view, setView }) {
  return <header className="eh-header">
    <div className="eh-header-inner">
      <div className="eh-brand"><span className="eh-brand-mark">E</span><span>EvidenceHire</span></div>
      <nav className="eh-nav" aria-label="Основная навигация">
        <button type="button" aria-current={view === "today" ? "page" : undefined} onClick={() => setView("today")}>Сегодня</button>
        <button type="button" aria-current={view === "candidates" ? "page" : undefined} onClick={() => setView("candidates")}>Кандидаты</button>
        <button type="button" aria-current={view === "profiles" ? "page" : undefined} onClick={() => setView("profiles")}>Должности</button>
        <button type="button" aria-current={view === "quality" ? "page" : undefined} onClick={() => setView("quality")}>Качество</button>
        <button type="button" aria-current={view === "settings" ? "page" : undefined} onClick={() => setView("settings")}>Настройки</button>
      </nav>
    </div>
  </header>;
}

function Profiles({ profiles, onSelect, canCreate }) {
  const [search, setSearch] = useState("");
  const filtered = profiles.filter((profile) => `${profile.name} ${profile.family} ${profile.summary}`.toLowerCase().includes(search.toLowerCase()));
  const readyCount = profiles.filter((profile) => ["pilot", "validated"].includes(profile.status)).length;
  const draftCount = profiles.filter((profile) => profile.status === "draft").length;
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
      <div><h2>Должности JOBS и Клячки</h2><p>{readyCount} готово к работе · {draftCount} ожидают подтверждения владельца</p></div>
      <div className="eh-actions"><div className="eh-search"><label className="eh-label" htmlFor="role-search">Найти должность</label><input id="role-search" className="eh-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например, администратор" /></div></div>
    </div>
    {!canCreate && <div className="eh-callout" style={{ marginBottom: 18 }}>Создавать карточки и отправлять задания могут владелец и администратор. Интервьюер работает только с уже назначенными оценками.</div>}
    <div className="eh-grid">
      {filtered.map((profile) => <button className="eh-profile-card" key={profile.id} type="button" disabled={!canCreate} onClick={() => onSelect(profile)}>
        <div className="eh-profile-top"><span className="eh-family">{profile.family}</span><span className="eh-status">{PROFILE_STATUS[profile.status]}</span></div>
        <h3>{profile.name}</h3><p>{profile.summary}</p>
        <div className="eh-card-meta"><span className="eh-chip">Рабочая проба</span><span className="eh-chip">{profile.interview.length} вопроса интервью</span><span className="eh-chip">{Object.keys(profile.competencies).length} компетенций</span></div>
      </button>)}
    </div>
  </>;
}

const PIPELINE_STAGES = [
  ["new", "Новый"], ["assignment", "Задание"], ["interview", "Интервью"], ["decision", "Решение"],
  ["offer", "Оффер"], ["hired", "Нанят"], ["reserve", "Резерв"], ["declined", "Отказ"],
];
const PIPELINE_LABELS = Object.fromEntries(PIPELINE_STAGES);

function CandidateForm({ profile, branches, onCancel, onCreate, onApprove, canApprove }) {
  const [form, setForm] = useState({ name: "", email: "", branchId: branches[0]?.id || "", includeWorkPreferences: false });
  const [review, setReview] = useState(() => ({
    reviewers: profile.jobAnalysisDraft?.reviewers || "",
    criticalTasks: profile.jobAnalysisDraft?.criticalTasks || "",
    criticalErrors: profile.jobAnalysisDraft?.criticalErrors || "",
    entryRequirements: profile.jobAnalysisDraft?.entryRequirements || "",
    outcomeDefinition: profile.jobAnalysisDraft?.outcomeDefinition || "",
    sample: false,
    anchors: false,
    accommodations: false,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const reviewReady = review.reviewers.split("\n").filter((item) => item.trim()).length >= 3
    && [review.criticalTasks, review.criticalErrors, review.entryRequirements, review.outcomeDefinition].every((value) => value.trim().length >= 20)
    && review.sample && review.anchors && review.accommodations;
  const create = async () => { setSubmitting(true); setError(""); try { await onCreate(createCandidateRecord({ ...form, profileId: profile.id, profileVersion: profile.version || 1, candidateModules: form.includeWorkPreferences ? [WORK_PREFERENCE_MODULE] : [] })); } catch (reason) { setError(reason?.message || "Не удалось создать оценку"); } finally { setSubmitting(false); } };
  return <div className="eh-panel">
    <div className="eh-role-head"><div><span className="eh-family">{profile.family}</span><h1>{profile.name}</h1><p>{profile.summary}</p></div><span className="eh-status">{PROFILE_STATUS[profile.status]}</span></div>
    <div className="eh-callout">{profile.status === "draft" ? "Черновик не подтверждён руководителем роли. Создание реальной оценки заблокировано до документированного анализа работы и выпуска пилотной версии." : "Пилот используется без проходного балла и автоматического отсева. Решение принимается по наблюдаемым фактам после двух независимых оценок."}</div>
    {profile.kpiTargets?.length > 0 && <div className="eh-callout" style={{ marginTop: 14 }}><strong>Целевые показатели роли</strong><ul>{profile.kpiTargets.map((item) => <li key={item.id}>{item.label}: не ниже {item.target}{item.unit}{item.derived ? " — итог двух этапов по 60%" : ""}</li>)}</ul></div>}
    {profile.status === "draft" && <section style={{ marginTop: 24 }}><h2>Подтвердить анализ работы</h2><p className="eh-helper">Заполните вместе с руководителем роли и минимум двумя сильными сотрудниками. Новая версия сохранит эти основания; старые карточки не изменятся.</p><div className="eh-form-grid">
      <div className="eh-form-field-full"><label className="eh-label" htmlFor="reviewers">Участники — каждый с новой строки *</label><textarea id="reviewers" className="eh-textarea" disabled={!canApprove} value={review.reviewers} onChange={(event) => setReview({ ...review, reviewers: event.target.value })} placeholder="Руководитель роли — имя и должность&#10;Сильный сотрудник 1 — имя и должность&#10;Сильный сотрудник 2 — имя и должность" /></div>
      <div><label className="eh-label" htmlFor="critical-tasks">Критичные задачи и рабочие продукты *</label><textarea id="critical-tasks" className="eh-textarea" disabled={!canApprove} value={review.criticalTasks} onChange={(event) => setReview({ ...review, criticalTasks: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="critical-errors">Критичные ошибки и последствия *</label><textarea id="critical-errors" className="eh-textarea" disabled={!canApprove} value={review.criticalErrors} onChange={(event) => setReview({ ...review, criticalErrors: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="entry-requirements">Что обязательно уметь уже на входе *</label><textarea id="entry-requirements" className="eh-textarea" disabled={!canApprove} value={review.entryRequirements} onChange={(event) => setReview({ ...review, entryRequirements: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="outcome-definition">Один проверяемый результат 90-го дня *</label><textarea id="outcome-definition" className="eh-textarea" disabled={!canApprove} value={review.outcomeDefinition} onChange={(event) => setReview({ ...review, outcomeDefinition: event.target.value })} placeholder="Формула, источник, период, знаменатель и рабочий контекст" /></div>
    </div><div className="eh-stack" style={{ marginTop: 14 }}>
      <label><input type="checkbox" disabled={!canApprove} checked={review.sample} onChange={(event) => setReview({ ...review, sample: event.target.checked })} /> Практическая проба действительно повторяет важную часть работы.</label>
      <label><input type="checkbox" disabled={!canApprove} checked={review.anchors} onChange={(event) => setReview({ ...review, anchors: event.target.checked })} /> Якоря 1/3/5 понятны и различимы по наблюдаемому поведению.</label>
      <label><input type="checkbox" disabled={!canApprove} checked={review.accommodations} onChange={(event) => setReview({ ...review, accommodations: event.target.checked })} /> Для всех одинаковы время и инструкции; необходимые адаптации фиксируются, но не штрафуются.</label>
    </div>{canApprove ? <button type="button" className="eh-btn eh-btn-primary" style={{ marginTop: 18 }} disabled={!reviewReady || submitting} onClick={async () => { setSubmitting(true); setError(""); try { await onApprove(review); } catch (reason) { setError(reason?.message || "Не удалось сохранить анализ работы"); } finally { setSubmitting(false); } }}>Сохранить новую пилотную версию</button> : <p className="eh-helper">Подтвердить анализ работы может только владелец организации.</p>}</section>}
    {profile.status !== "draft" && <>
    <h2 style={{ marginTop: 26 }}>Новая оценка</h2>
    <div className="eh-form-grid">
      <div><label className="eh-label" htmlFor="candidate-name">Имя кандидата</label><input id="candidate-name" className="eh-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></div>
      <div><label className="eh-label" htmlFor="candidate-email">Email — необязательно</label><input id="candidate-email" className="eh-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" autoComplete="email" /></div>
      <div className="eh-form-field-full"><label className="eh-label" htmlFor="candidate-branch">Школа</label><select id="candidate-branch" className="eh-select" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
      <div className="eh-form-field-full eh-callout"><label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={form.includeWorkPreferences} onChange={(event) => setForm({ ...form, includeWorkPreferences: event.target.checked })} /><span><strong>Добавить карту рабочих предпочтений</strong><br /><span className="eh-helper">166 пар, около 45–50 минут. Дополнительные гипотезы для интервью без проходного балла и автоматического отказа. Рабочая проба и интервью остаются обязательными.</span></span></label></div>
      <div className="eh-form-field-full"><p className="eh-helper">Не собирайте возраст, пол, семейное положение и другие данные, не связанные с выполнением работы. Перед отправкой заданий получите согласие на обработку контактных данных.</p></div>
    </div>
    {error && <div role="alert" className="eh-callout" style={{ marginTop: 16 }}>{error}</div>}
    {!branches.length && <div role="alert" className="eh-callout" style={{ marginTop: 16 }}>Для этого аккаунта не назначен филиал. Владелец должен добавить доступ до создания кандидата.</div>}
    <div className="eh-actions" style={{ marginTop: 22 }}><button className="eh-btn eh-btn-primary" type="button" disabled={profile.status === "draft" || !form.name.trim() || !form.branchId || submitting} onClick={create}>{submitting ? "Создаём…" : "Создать оценку"}</button><button className="eh-btn eh-btn-ghost" type="button" onClick={onCancel}>Отмена</button></div>
    </>}
    {profile.status === "draft" && <div className="eh-actions" style={{ marginTop: 18 }}><button className="eh-btn eh-btn-ghost" type="button" onClick={onCancel}>Назад к должностям</button></div>}
  </div>;
}

function Stage({ index, title, subtitle, open, onToggle, children }) {
  return <section className="eh-stage">
    <button type="button" className="eh-stage-summary" aria-expanded={open} onClick={onToggle}><span className="eh-stage-index">{index}</span><span className="eh-stage-title"><h3>{title}</h3><p>{subtitle}</p></span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <div className="eh-stage-body">{children}</div>}
  </section>;
}

function ReferenceCheckForm({ value, onChange, questions, disabled = false }) {
  const form = parseReferenceCheck(value || "");
  const update = (patch) => onChange(serializeReferenceCheck({ ...form, ...patch }));
  return <>
    <div><label className="eh-label" htmlFor="reference-disposition">Статус проверки *</label><select id="reference-disposition" className="eh-select" disabled={disabled} value={form.disposition} onChange={(event) => update({ disposition: event.target.value })}><option value="">Не зафиксирован</option><option value="completed">Проведена</option><option value="unavailable">Недоступна — с причиной</option><option value="not_applicable">Неприменима — с причиной</option></select></div>
    {form.legacyNotes && <div className="eh-callout" style={{ marginTop: 12 }}>Сохранены прежние свободные заметки: {form.legacyNotes}</div>}
    {form.disposition === "completed" && <div className="eh-stack" style={{ marginTop: 16 }}>
      <label><input type="checkbox" disabled={disabled} checked={form.consentConfirmed === true} onChange={(event) => update({ consentConfirmed: event.target.checked })} /> Кандидат согласился на контакт с рекомендателем.</label>
      <div><label className="eh-label" htmlFor="recommender">Имя и роль рекомендателя *</label><input id="recommender" className="eh-input" disabled={disabled} value={form.recommenderNameRole} onChange={(event) => update({ recommenderNameRole: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="relationship">Рабочая связь и даты совместной работы *</label><input id="relationship" className="eh-input" disabled={disabled} value={form.relationshipDates} onChange={(event) => update({ relationshipDates: event.target.value })} /></div>
      <ol className="eh-reference-questions">{questions.map((question) => <li key={question}>{question}</li>)}</ol>
      <div><label className="eh-label" htmlFor="reference-answers">Ответы и лично подтверждённые факты *</label><textarea id="reference-answers" className="eh-textarea" disabled={disabled} value={form.answers} onChange={(event) => update({ answers: event.target.value })} placeholder="По каждому вопросу: подтверждает, не знает или сообщает противоречащий факт." /></div>
      <div><label className="eh-label" htmlFor="reference-discrepancies">Расхождения</label><textarea id="reference-discrepancies" className="eh-textarea" disabled={disabled} value={form.discrepancies} onChange={(event) => update({ discrepancies: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="candidate-explanation">Объяснение кандидата по расхождениям</label><textarea id="candidate-explanation" className="eh-textarea" disabled={disabled} value={form.candidateExplanation} onChange={(event) => update({ candidateExplanation: event.target.value })} /></div>
    </div>}
    {["unavailable", "not_applicable"].includes(form.disposition) && <div style={{ marginTop: 16 }}><label className="eh-label" htmlFor="reference-unavailable">Причина *</label><textarea id="reference-unavailable" className="eh-textarea" disabled={disabled} value={form.unavailableReason} onChange={(event) => update({ unavailableReason: event.target.value })} placeholder="Например: первая работа кандидата; рекомендатель не ответил после двух попыток. Отсутствие ответа не считается отрицательной рекомендацией." /></div>}
  </>;
}

function Scorecard({ candidate, profile, decisionViewer = false, submitted }) {
  if (decisionViewer) return <aside className="eh-panel eh-score-card">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Решение комиссии</p>
    <div className="eh-evidence-state"><strong>{submitted.completeRaters} из {submitted.minimumRaters}</strong><span>независимых оценок завершено</span></div>
    <div className="eh-score-decision">Факты обоих оценщиков открыты в матрице решения.</div>
    <p className="eh-helper" style={{ marginTop: 18 }}>Вы не добавляете фиктивную третью оценку: разберите расхождения и зафиксируйте решение по наблюдаемым фактам.</p>
  </aside>;
  const result = calculateAssessment(profile, candidate.interviewRatings, candidate.workSampleRatings);
  const documentation = documentedEvidenceStatus(profile, candidate);
  const guidance = buildVerificationGuidance(profile, result);
  return <aside className="eh-panel eh-score-card">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>{candidate.currentRaterSubmittedAt ? "Ваша завершённая оценка" : "Ваша независимая оценка"}</p>
    <div className="eh-evidence-state"><strong>{result.completedTotal} из {result.requiredTotal}</strong><span>обязательных оценок заполнено</span></div>
    <div className="eh-score-decision">{result.decision}</div>
    <div className="eh-progress-line"><div className="eh-progress-track"><span style={{ width: `${result.completion}%` }} /></div><div className="eh-progress-label"><span>Полнота оценки</span><strong>{result.completion}%</strong></div></div>
    <div className="eh-method-status">
      <span>Рабочая проба <strong>{result.methodStatus.work_sample.completed}/{result.methodStatus.work_sample.required}</strong></span>
      <span>Интервью <strong>{result.methodStatus.structured_interview.completed}/{result.methodStatus.structured_interview.required}</strong></span>
    </div>
    {!documentation.complete && <p className="eh-helper">До завершения добавьте факты к каждому ответу и наблюдения по проведённой рабочей пробе.</p>}
    <div className="eh-competencies">
      {result.competencyScores.map((row) => <div className="eh-competency" key={row.id}><span>{COMPETENCIES[row.id]?.name || row.id}</span><strong>{row.score == null ? "Нет данных" : `${row.score.toFixed(1)} / 5`}</strong><small>Наблюдений: {row.evidenceCount}</small></div>)}
    </div>
    <details className="eh-next-step" style={{ marginTop: 18 }}>
      <summary>Что проверить дальше</summary>
      {guidance.missing.length > 0 && <div className="eh-guidance"><strong>Не хватает данных</strong><p>{guidance.missing.join("; ")}.</p></div>}
      {guidance.weak.length > 0 && <div className="eh-guidance"><strong>Нужна перепроверка, а не мгновенный отказ</strong><p>{guidance.weak.join("; ")}.</p></div>}
      <div className="eh-guidance"><strong>Короткая ролевая перепроверка</strong><p>{guidance.scenario}</p></div>
      <div className="eh-guidance"><strong>Одинаковые уточнения</strong><p>{guidance.probes.join(" ")}</p></div>
      <p className="eh-helper">Используйте одну и ту же проверку и шкалу для сопоставимых кандидатов. Новый факт записывайте отдельно; не заменяйте им неудобный результат задним числом.</p>
    </details>
    <p className="eh-helper" style={{ marginTop: 18 }}>Общий рейтинг и автоматический вердикт отключены: профили пока не подтверждены локальными данными. Решение принимает комиссия по фактам.</p>
  </aside>;
}

function DecisionMatrix({ matrix }) {
  if (matrix.raters.length < 2) return null;
  return <section className="eh-decision-matrix" aria-labelledby="decision-matrix-title">
    <div className="eh-role-head"><div><span className="eh-family">Две закрытые формы</span><h3 id="decision-matrix-title">Матрица оценок и фактов</h3></div></div>
    <div className="eh-decision-table-wrap"><table className="eh-decision-table">
      <thead><tr><th scope="col">Критерий</th>{matrix.raters.map((rater) => <th scope="col" key={rater.raterId}>{rater.label}</th>)}</tr></thead>
      <tbody>{matrix.rows.map((row) => <tr key={row.id} className={row.needsCalibration ? "needs-calibration" : ""}>
        <th scope="row"><span>{row.method === "work_sample" ? "Рабочая проба" : "Интервью"}</span><strong>{COMPETENCIES[row.competency]?.name || row.competency}</strong><p>{row.label}</p>{row.needsCalibration && <em>Расхождение: {row.range} балла</em>}</th>
        {row.evidence.map((entry) => <td key={entry.raterId}><strong>{entry.score} / 5</strong><p>{entry.facts || "Факт не зафиксирован"}</p></td>)}
      </tr>)}</tbody>
    </table></div>
    <p className="eh-helper">Исходные оценки не изменяются. При расхождении комиссия сверяет только наблюдаемые факты.</p>
  </section>;
}

function methodEvidenceSummary(matrix, method) {
  const rows = matrix.rows.filter((row) => row.method === method);
  const scores = rows.flatMap((row) => row.evidence.map((entry) => entry.score)).filter((score) => score != null);
  return {
    criteria: rows.length,
    disagreements: rows.filter((row) => row.needsCalibration).length,
    minimum: scores.length ? Math.min(...scores) : null,
    maximum: scores.length ? Math.max(...scores) : null,
  };
}

function Assessment({ candidate, profile, onChange, onChangeOutcome, onBack, onArchive, onRestore, onSave, onSaveOutcome, onCreateInvite, onSetCandidateModules, onSubmitRating, onAddNote, saveState, saveError, ratingState, canManageOutcomes, canManageCrm, canArchive, canDecide, canReviewSubmittedWithoutOwnRating, canInvite, demo }) {
  const [open, setOpen] = useState({ sample: true, interview: false, decision: false, references: false, outcome: false });
  const [inviteState, setInviteState] = useState({ status: "", url: "" });
  const [note, setNote] = useState("");
  const [moduleState, setModuleState] = useState("idle");
  const result = calculateAssessment(profile, candidate.interviewRatings, candidate.workSampleRatings);
  const documentation = documentedEvidenceStatus(profile, candidate);
  const workPreferenceMap = buildWorkPreferenceMap(candidate.workPreferenceAnswers || []);
  const submitted = decisionReadiness(profile, candidate, 2);
  const currentSubmitted = Boolean(candidate.currentRaterSubmittedAt);
  const { decisionReady, decisionViewer, blindRating, ratingLocked } = assessmentAccessState({
    profileStatus: profile.status,
    submittedReady: submitted.ready,
    currentSubmitted,
    canManageCrm,
    canDecide,
    canReviewSubmittedWithoutOwnRating,
  });
  const referenceReady = referenceDispositionComplete(candidate.referenceNotes || "");
  const referenceLocked = candidate.finalDecision === "offer" || ["offer", "hired"].includes(candidate.pipelineStage);
  const terminalStages = new Set(["decision", "offer", "hired", "reserve", "declined"]);
  const requiredDecisionByStage = { offer: "offer", hired: "offer", reserve: "reserve", declined: "decline" };
  const decisionMatrix = buildDecisionMatrix(profile, candidate);
  const changeDecision = (finalDecision) => {
    const terminalStageByDecision = { offer: candidate.pipelineStage === "hired" ? "hired" : "offer", reserve: "reserve", decline: "declined" };
    const pipelineStage = ["offer", "hired", "reserve", "declined"].includes(candidate.pipelineStage)
      ? (terminalStageByDecision[finalDecision] || "decision")
      : candidate.pipelineStage;
    onChange({ ...candidate, finalDecision, pipelineStage });
  };
  const disagreements = decisionMatrix.rows.filter((row) => row.needsCalibration);
  const setRating = (field, id, value) => onChange({ ...candidate, [field]: { ...candidate[field], [id]: value } });
  return <>
    <button type="button" className="eh-btn eh-btn-ghost eh-back" onClick={onBack}>← К кандидатам</button>
    <div className="eh-role-head"><div><span className="eh-family">{profile.family}</span><h1>{candidate.name}</h1><p>{profile.name} · {branchById(candidate.branchId).name} · создано {new Date(candidate.createdAt).toLocaleDateString("ru-RU")}</p></div><div className="eh-actions"><button type="button" className="eh-btn eh-btn-ghost eh-print-button" onClick={() => { setOpen({ sample: true, interview: true, decision: true, references: true, outcome: true }); setTimeout(() => window.print(), 50); }}>Печать</button>{canInvite && !candidate.archivedAt && <button type="button" className="eh-btn eh-btn-secondary" disabled={demo || inviteState.status === "loading"} onClick={async () => { setInviteState({ status: "loading", url: "" }); try { const link = await onCreateInvite(); setInviteState({ status: "ready", url: link }); try { await navigator.clipboard.writeText(link); } catch { /* The visible URL remains available for manual copy on Safari. */ } } catch { setInviteState({ status: "error", url: "" }); } }}>Ссылка кандидату</button>}<button type="button" className="eh-btn eh-btn-primary" disabled={saveState === "saving" || Boolean(candidate.archivedAt)} onClick={() => onSave()}>{saveState === "saving" ? "Сохраняем…" : saveState === "saved" ? "Сохранено ✓" : "Сохранить"}</button>{canArchive && (candidate.archivedAt ? <button type="button" className="eh-btn eh-btn-secondary" onClick={onRestore}>Восстановить</button> : <button type="button" className="eh-btn eh-btn-danger" onClick={onArchive}>В архив</button>)}</div></div>
    {candidate.archivedAt && <div className="eh-callout" style={{ marginBottom: 16 }}>Карточка находится в архиве. Все ответы, оценки и заметки сохранены.</div>}
    {inviteState.status === "ready" && <div role="status" className="eh-callout" style={{ marginBottom: 16 }}><label className="eh-label" htmlFor="candidate-invite-link">Одноразовая ссылка действует 7 дней</label><div className="eh-note-composer"><div><input id="candidate-invite-link" className="eh-input" readOnly value={inviteState.url} onFocus={(event) => event.target.select()} /><button type="button" className="eh-btn eh-btn-secondary" onClick={() => navigator.clipboard.writeText(inviteState.url).catch(() => {})}>Копировать</button></div></div></div>}
    {inviteState.status === "error" && <div role="alert" className="eh-callout" style={{ marginBottom: 16 }}>Не удалось создать ссылку кандидату.</div>}
    {demo && <p className="eh-helper" style={{ marginTop: -12, marginBottom: 16 }}>Защищённые ссылки доступны после входа и применения целевой схемы базы данных.</p>}
    {saveState === "error" && <div role="alert" className="eh-callout" style={{ marginBottom: 16 }}>{saveError || "Не удалось сохранить изменения. Проверьте соединение и права доступа."}</div>}
    {blindRating ? <div className="eh-blind-notice" role="status"><strong>Независимая оценка</strong><span>До фиксации вашей формы скрыты этап CRM, источник, комментарии команды, предварительное решение и исторические тесты.</span></div> : <section className="eh-panel eh-crm-strip" aria-label="Управление кандидатом">
      <div><label className="eh-label" htmlFor="pipeline-stage">Этап воронки</label><select id="pipeline-stage" className="eh-select" disabled={!canManageCrm} value={candidate.pipelineStage || "new"} onChange={(event) => onChange({ ...candidate, pipelineStage: event.target.value })}>{PIPELINE_STAGES.map(([id, label]) => <option key={id} value={id} disabled={(terminalStages.has(id) && !decisionReady) || (["offer", "hired"].includes(id) && !referenceReady) || (requiredDecisionByStage[id] && candidate.finalDecision !== requiredDecisionByStage[id])}>{label}</option>)}</select></div>
      <div><label className="eh-label" htmlFor="next-action">Следующее действие</label><input id="next-action" className="eh-input" disabled={!canManageCrm} value={candidate.nextAction || ""} onChange={(event) => onChange({ ...candidate, nextAction: event.target.value })} placeholder="Позвонить, назначить интервью…" /></div>
      <div><label className="eh-label" htmlFor="next-action-at">Срок</label><input id="next-action-at" className="eh-input" disabled={!canManageCrm} type="datetime-local" value={candidate.nextActionAt || ""} onChange={(event) => onChange({ ...candidate, nextActionAt: event.target.value })} /></div>
      <div><label className="eh-label" htmlFor="candidate-source">Источник</label><input id="candidate-source" className="eh-input" disabled={!canManageCrm} value={candidate.source || ""} onChange={(event) => onChange({ ...candidate, source: event.target.value })} placeholder="HH, рекомендация, соцсети…" /></div>
      {(candidate.pipelineStage === "declined" || candidate.finalDecision === "decline") && <div className="eh-form-field-full"><label className="eh-label" htmlFor="rejection-reason">Причина отказа</label><input id="rejection-reason" className="eh-input" disabled={!canManageCrm} value={candidate.rejectionReason || ""} onChange={(event) => onChange({ ...candidate, rejectionReason: event.target.value })} placeholder="Только рабочие критерии, без личных характеристик" /></div>}
      <div className="eh-form-field-full eh-note-composer"><label className="eh-label" htmlFor="candidate-note">Комментарий команды</label><div><input id="candidate-note" className="eh-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Факт разговора, договорённость или наблюдение" /><button type="button" className="eh-btn eh-btn-secondary" disabled={note.trim().length < 2} onClick={async () => { await onAddNote(note); setNote(""); }}>Добавить</button></div>{candidate.notes?.length > 0 && <ul className="eh-note-list">{candidate.notes.slice(0, 5).map((item) => <li key={item.id}><span>{new Date(item.created_at).toLocaleString("ru-RU")}</span>{item.body}</li>)}</ul>}</div>
      <div className="eh-form-field-full eh-callout"><label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" disabled={!canManageCrm || candidate.hasInvite || moduleState === "saving"} checked={(candidate.candidateModules || []).includes(WORK_PREFERENCE_MODULE)} onChange={async (event) => { const modules = event.target.checked ? [WORK_PREFERENCE_MODULE] : []; setModuleState("saving"); try { await onSetCandidateModules(modules); setModuleState("saved"); } catch { setModuleState("error"); } }} /><span><strong>Карта рабочих предпочтений · 45–50 минут</strong><br /><span className="eh-helper">Необязательная гипотеза для интервью, без проходного балла. {candidate.hasInvite ? "Набор этапов зафиксирован после создания первой ссылки." : moduleState === "saving" ? "Сохраняем выбор…" : moduleState === "error" ? "Не удалось сохранить выбор." : "Можно изменить до создания ссылки кандидату."}</span></span></label></div>
    </section>}
    <div className="eh-score-layout">
      <div className="eh-stack">
        <Stage index="1" title={profile.workSample.title} subtitle={`Рабочая проба · около ${profile.workSample.minutes} минут`} open={open.sample} onToggle={() => setOpen({ ...open, sample: !open.sample })}>
          <div className="eh-work-prompt">{profile.workSample.prompt}</div>
          {profile.workSample.observedFormat && <div className="eh-callout"><strong>Оценивается наблюдаемое упражнение</strong><br />{profile.workSample.observedFormat}</div>}
          {profile.screening?.length > 0 && <div className="eh-screening-review"><h4>Короткий фильтр условий</h4>{profile.screening.map((question) => <div key={question.id}><strong>{question.label}</strong><p>{candidate.screeningResponses?.[question.id] || "Кандидат пока не ответил"}</p></div>)}</div>}
          {(candidate.candidateModules || []).includes(WORK_PREFERENCE_MODULE) && <div className="eh-candidate-response"><strong>Дополнительные гипотезы: карта рабочих предпочтений</strong>{workPreferenceMap ? <><p>{workPreferenceMap.note}</p><ol>{workPreferenceMap.topThemes.map((theme) => <li key={theme.id}><strong>{theme.name}</strong><p>Проверьте примером: {theme.interviewQuestion}</p></li>)}</ol></> : <p>Кандидат ещё не завершил 166 пар. Этот модуль не влияет на готовность решения.</p>}</div>}
          {candidate.candidateWorkSample && <div className="eh-candidate-response"><strong>Ответ кандидата</strong><pre>{candidate.candidateWorkSample}</pre></div>}
          <label className="eh-label" htmlFor="sample-notes">Факты наблюдения{candidate.candidateWorkSample ? "" : " или ссылка на выполненную работу"}</label><textarea id="sample-notes" className="eh-textarea" disabled={ratingLocked} value={candidate.workSampleNotes} onChange={(event) => onChange({ ...candidate, workSampleNotes: event.target.value })} placeholder="Не менее 20 символов: что кандидат сделал и сказал в упражнении до выставления оценок." />
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "14px 0", lineHeight: 1.5 }}><input type="checkbox" disabled={ratingLocked} checked={candidate.observedConfirmed === true} onChange={(event) => onChange({ ...candidate, observedConfirmed: event.target.checked })} /><span>Подтверждаю: я наблюдал(а) стандартное практическое упражнение, использовал(а) одинаковые инструкции и время, а отклонения или необходимые адаптации записал(а) выше.</span></label>
          {profile.workSample.rubric.map((item) => <div className="eh-question" key={item.id}><span className="eh-question-meta">{COMPETENCIES[item.competency]?.name}</span><h4>{item.criterion}</h4><div className="eh-anchor-grid">{[1,3,5].map((score) => <div className="eh-anchor" key={score}><strong>{score}</strong> · {item.anchors[score]}</div>)}</div><Rating disabled={ratingLocked} label={`Оценка: ${item.criterion}`} value={candidate.workSampleRatings[item.id]} onChange={(value) => setRating("workSampleRatings", item.id, value)} /></div>)}
        </Stage>
        <Stage index="2" title="Структурированное интервью" subtitle="Одинаковые вопросы и критерии для всех кандидатов" open={open.interview} onToggle={() => setOpen({ ...open, interview: !open.interview })}>
          {profile.interview.map((question) => <div className="eh-question" key={question.id}><span className="eh-question-meta">{COMPETENCIES[question.competency]?.name}</span><h4>{question.text}</h4><label className="eh-label" htmlFor={`note-${question.id}`}>Факты из ответа</label><textarea id={`note-${question.id}`} className="eh-textarea" disabled={ratingLocked} value={candidate.interviewNotes[question.id] || ""} onChange={(event) => onChange({ ...candidate, interviewNotes: { ...candidate.interviewNotes, [question.id]: event.target.value } })} placeholder="Не менее 10 символов: контекст, личные действия, результат и уточняющие факты" /><div className="eh-anchor-grid">{[1,3,5].map((score) => <div className="eh-anchor" key={score}><strong>{score}</strong> · {question.anchors[score]}</div>)}</div><Rating disabled={ratingLocked} label={`Оценка ответа на вопрос: ${question.text}`} value={candidate.interviewRatings[question.id]} onChange={(value) => setRating("interviewRatings", question.id, value)} /></div>)}
          {decisionViewer ? <div className="eh-callout">Две независимые оценки уже собраны. Как лицо, принимающее решение, вы не добавляете фиктивную третью оценку.</div> : currentSubmitted ? <div className="eh-callout">Ваша независимая оценка завершена и заблокирована от изменения.</div> : <><p className="eh-helper">Используйте только значения 1, 3 или 5 — для них заранее описаны поведенческие якоря. Оценки коллег откроются после фиксации вашей формы.</p><button type="button" className="eh-btn eh-btn-primary" disabled={ratingState === "saving" || !result.allRequiredMethodsComplete || !documentation.complete} onClick={onSubmitRating}>{ratingState === "saving" ? "Завершаем…" : "Завершить и зафиксировать оценку"}</button>{(!result.allRequiredMethodsComplete || !documentation.complete) && <p className="eh-helper">Заполните все оценки 1/3/5, факты интервью и наблюдения по рабочей пробе.</p>}</>}
        </Stage>
        <Stage index="3" title="Решение комиссии" subtitle="Фиксируется после независимых оценок" open={open.decision} onToggle={() => setOpen({ ...open, decision: !open.decision })}>
          {blindRating ? <div className="eh-blind-decision"><strong>Сначала зафиксируйте свою оценку</strong><p>Предварительное решение, оценки коллег и командные комментарии намеренно скрыты, чтобы не влиять на ваши баллы.</p></div> : <>
            <div className="eh-callout">Для пилотных профилей нужны две независимо завершённые оценки. Разногласие в два и более балла разбирается по фактам, а не усредняется автоматически.</div>
            <div className="eh-calibration"><strong>Завершённых независимых оценок: {submitted.completeRaters} из {submitted.minimumRaters}</strong>{decisionMatrix.raters.length > 1 && (disagreements.length ? <p>Требуют разбора по фактам: {disagreements.length} критериев.</p> : <p>Расхождений в два и более балла не найдено.</p>)}</div>
            <DecisionMatrix matrix={decisionMatrix} />
            <div className="eh-form-grid" style={{ marginTop: 16 }}><div><label className="eh-label" htmlFor="decision">Решение</label><select id="decision" className="eh-select" disabled={!canDecide || !decisionReady} value={candidate.finalDecision || "pending"} onChange={(event) => changeDecision(event.target.value)}><option value="pending">Не принято</option><option value="next">Следующий этап</option><option value="offer" disabled={!referenceReady}>Оффер</option><option value="reserve">Кадровый резерв</option><option value="decline">Отказ</option></select></div><div><label className="eh-label" htmlFor="decision-reason">Обоснование по наблюдаемым фактам роли</label><textarea id="decision-reason" className="eh-textarea" disabled={!canDecide || !decisionReady} value={candidate.decisionReason || ""} onChange={(event) => onChange({ ...candidate, decisionReason: event.target.value })} placeholder="Какие факты из пробы и интервью подтверждают решение; не используйте общий балл или личностный ярлык." /></div></div>
            {!referenceReady && decisionReady && <p className="eh-helper">Оффер откроется после документированного статуса проверки рекомендаций. Недоступность рекомендации допустима и не считается отрицательным сигналом.</p>}
            {!decisionReady && <p className="eh-helper">{profile.status === "draft" ? "Черновой профиль нельзя использовать для оффера или отказа. Сначала владелец подтверждает анализ работы и запускает новую пилотную версию." : "Нужны две полноценные завершённые оценки. Администр увидит их только после фиксации своей формы; владелец может принять решение без третьей оценки."}</p>}
            {!canDecide && <p className="eh-helper">Финальное решение фиксирует владелец или администратор после независимых оценок комиссии.</p>}
          </>}
        </Stage>
        <Stage index="4" title="Проверка рекомендаций" subtitle="Только для финалистов и с согласия кандидата" open={open.references} onToggle={() => setOpen({ ...open, references: !open.references })}>
          <div className="eh-callout">Проверка рекомендаций не является голосованием за кандидата. Она подтверждает даты, роль, заявленные результаты и условия наблюдения. Несовпадение нужно дать кандидату объяснить; отсутствие ответа не является отрицательным фактом.</div>
          {canManageCrm ? <><ReferenceCheckForm disabled={referenceLocked} value={candidate.referenceNotes || ""} onChange={(referenceNotes) => onChange({ ...candidate, referenceNotes })} questions={profile.referenceQuestions || []} />{referenceLocked && <p className="eh-helper">Статус рекомендации зафиксирован после оффера и доступен только для чтения.</p>}</> : <p className="eh-helper">Проверку рекомендаций фиксирует владелец или администратор филиала.</p>}
          <p className="eh-helper">Статус заполнен: {referenceReady ? "да" : "нет"}. Для оффера достаточно документировать результат проверки или обоснованную недоступность — «положительная рекомендация» не требуется.</p>
        </Stage>
        <Stage index="5" title="Проверка прогноза" subtitle="Фактические KPI через 30, 60 и 90 дней" open={open.outcome} onToggle={() => setOpen({ ...open, outcome: !open.outcome })}>
          <div className="eh-callout">Основной результат 90-го дня зафиксирован в анализе работы до первого кандидата. Для значения KPI обязательно укажите фактическую нагрузку, сезон, источник клиентов, состав команды и изменения процесса; без контекста наблюдение не сравнивается.</div>
          {profile.kpiTargets?.length > 0 && <div className="eh-callout" style={{ marginTop: 12 }}><strong>Рабочий стандарт</strong><ul>{profile.kpiTargets.map((item) => <li key={item.id}>{item.label}: не ниже {item.target}{item.unit}{item.derived ? " — основной итоговый KPI" : ""}</li>)}</ul></div>}
          <p className="eh-helper">Оценка руководителя: 1 — повторно не выполняет критичные договорённости после ясных ожиданий; 3 — надёжно выполняет стандарт и заранее сообщает о рисках; 5 — устойчиво превосходит стандарт без скрытой потери качества и улучшает процесс.</p>
          {[30, 60, 90].map((days) => { const stored = candidate.outcomes?.[days] || { retained: "", managerRating: "", kpiValue: "", kpiDefinition: "", kpiDefinitionLocked: false, notes: "" }; const value = { ...stored, kpiDefinition: stored.kpiDefinition || profile.jobAnalysis?.outcomeDefinition || "" }; const update = (patch) => onChangeOutcome(days, { ...value, ...patch }); return <div className="eh-question" key={days}>
            <h4>{days}-й день</h4><div className="eh-form-grid">
              <div><label className="eh-label" htmlFor={`retained-${days}`}>Продолжает работу</label><select id={`retained-${days}`} className="eh-select" disabled={!canManageOutcomes} value={value.retained} onChange={(event) => update({ retained: event.target.value })}><option value="">Нет данных</option><option value="true">Да</option><option value="false">Нет</option></select></div>
              <div><label className="eh-label" htmlFor={`manager-${days}`}>Якорь руководителя</label><select id={`manager-${days}`} className="eh-select" disabled={!canManageOutcomes} value={value.managerRating} onChange={(event) => update({ managerRating: event.target.value })}><option value="">Нет данных</option>{[1,3,5].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><label className="eh-label" htmlFor={`kpi-${days}`}>Значение KPI</label><input id={`kpi-${days}`} className="eh-input" type="number" disabled={!canManageOutcomes} value={value.kpiValue} onChange={(event) => update({ kpiValue: event.target.value })} /></div>
              <div><label className="eh-label" htmlFor={`kpi-def-${days}`}>Формула, источник и период KPI</label><input id={`kpi-def-${days}`} className="eh-input" disabled={!canManageOutcomes || Boolean(profile.jobAnalysis?.outcomeDefinition) || value.kpiDefinitionLocked} value={value.kpiDefinition} onChange={(event) => update({ kpiDefinition: event.target.value })} placeholder="Формула, источник, окно и знаменатель" /></div>
              <div className="eh-form-field-full"><label className="eh-label" htmlFor={`outcome-note-${days}`}>Рабочий контекст и ограничения сравнения</label><textarea id={`outcome-note-${days}`} className="eh-textarea" disabled={!canManageOutcomes} value={value.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Нагрузка, лиды/смены/группы, сезон, состав команды, изменения рекламы или процесса, пропуски данных" /></div>
            </div>{canManageOutcomes && <button type="button" className="eh-btn eh-btn-secondary" onClick={() => onSaveOutcome(days, value)}>Сохранить данные {days}-го дня</button>}
          </div>; })}
          {!canManageOutcomes && <p className="eh-helper">Изменять исходы могут только владелец или администратор организации.</p>}
        </Stage>
      </div>
      <Scorecard candidate={candidate} profile={profile} decisionViewer={decisionViewer} submitted={submitted} />
    </div>
  </>;
}

function Today({ candidates, onOpen, onNew, onCandidates, onProfiles, canCreate, canApproveProfiles, pilotProfileCount }) {
  if (!canCreate) {
    const assigned = candidates.filter((item) => !item.archivedAt);
    const pending = assigned.filter((item) => !item.currentRaterSubmittedAt);
    const completed = assigned.filter((item) => item.currentRaterSubmittedAt);
    return <>
      <section className="eh-hero eh-today-hero"><div className="eh-hero-copy"><p className="eh-kicker">Независимая оценка</p><h1>Ваши назначенные формы</h1><p>До завершения оценки CRM-этап, источник, командные комментарии и решение скрыты.</p></div></section>
      <div className="eh-metric-grid eh-metric-grid-compact">
        <button type="button" onClick={onCandidates}><span>Нужно оценить</span><strong>{pending.length}</strong><small>незавершённых форм</small></button>
        <button type="button" onClick={onCandidates}><span>Завершено</span><strong>{completed.length}</strong><small>зафиксированных форм</small></button>
      </div>
      <div className="eh-toolbar"><div><h2>На оценку</h2><p>Сначала завершите свою форму</p></div><button type="button" className="eh-btn eh-btn-ghost" onClick={onCandidates}>Все формы</button></div>
      {!pending.length ? <div className="eh-empty"><h3>Незавершённых оценок нет</h3><p>Новые назначения появятся здесь.</p></div> : <div className="eh-candidates">{pending.slice(0, 8).map((item) => <button type="button" className="eh-candidate eh-candidate-button" key={item.id} onClick={() => onOpen(item)}><div><strong>{item.name}</strong><p>{item.profileDefinition?.name || "Структурированная оценка"} · CRM-данные скрыты</p></div><span>Оценить →</span></button>)}</div>}
    </>;
  }
  const activeStages = new Set(["new", "assignment", "interview", "decision", "offer"]);
  const active = candidates.filter((item) => !item.archivedAt && activeStages.has(item.pipelineStage || "new"));
  const overdue = active.filter((item) => item.nextActionAt && new Date(item.nextActionAt) < new Date());
  const submitted = active.filter((item) => item.candidateSubmittedAt && !Object.keys(item.workSampleRatings || {}).length);
  const waitingDecision = active.filter((item) => item.pipelineStage === "decision" && (!item.finalDecision || item.finalDecision === "pending"));
  const priority = [...overdue, ...submitted, ...waitingDecision].filter((item, index, rows) => rows.findIndex((row) => row.id === item.id) === index).slice(0, 8);
  const profilesReady = pilotProfileCount > 0;
  return <>
    <section className="eh-hero eh-today-hero"><div className="eh-hero-copy"><p className="eh-kicker">Рабочий стол найма</p><h1>Что требует внимания сегодня</h1><p>Кандидаты JOBS и Клячки, следующие действия и доказательства — в одном месте.</p>{canCreate && <button type="button" className="eh-btn eh-btn-light" onClick={profilesReady ? onNew : onProfiles}>{profilesReady ? "Добавить кандидата" : canApproveProfiles ? "Активировать первую должность" : "Посмотреть должности"}</button>}</div></section>
    {!profilesReady && <div className="eh-callout" style={{ marginBottom: 18 }}><strong>{canApproveProfiles ? "Сначала подтвердите первую должность." : "Новые оценки пока не отправляются."}</strong><br />{canApproveProfiles ? "Выберите должность и зафиксируйте анализ работы вместе с руководителем роли и двумя сильными сотрудниками. После сохранения пилота управляющие и HR смогут создавать кандидатов." : "Владелец организации подтверждает рабочую пробу, критерии и результат 90-го дня. Исторический архив и существующие карточки остаются доступны."}</div>}
    <div className="eh-metric-grid">
      <button type="button" onClick={onCandidates}><span>Активные</span><strong>{active.length}</strong><small>во всех филиалах с доступом</small></button>
      <button type="button" onClick={onCandidates}><span>Просрочено</span><strong>{overdue.length}</strong><small>следующих действий</small></button>
      <button type="button" onClick={onCandidates}><span>Проверить</span><strong>{submitted.length}</strong><small>заданий кандидатов</small></button>
      <button type="button" onClick={onCandidates}><span>Решение</span><strong>{waitingDecision.length}</strong><small>ожидают комиссии</small></button>
    </div>
    <div className="eh-toolbar"><div><h2>Приоритетные кандидаты</h2><p>Сначала просроченные действия, затем новые ответы и решения</p></div><button type="button" className="eh-btn eh-btn-ghost" onClick={onCandidates}>Вся воронка</button></div>
    {!priority.length ? <div className="eh-empty"><h3>Срочных действий нет</h3><p>{profilesReady ? "Добавьте кандидата или откройте общую воронку." : canApproveProfiles ? "Начните с подтверждения первой должности." : "Пока можно работать с историческим архивом; новые оценки появятся после подтверждения должности владельцем."}</p></div> : <div className="eh-candidates">{priority.map((item) => <button type="button" className="eh-candidate eh-candidate-button" key={item.id} onClick={() => onOpen(item)}><div><strong>{item.name}</strong><p>{PIPELINE_LABELS[item.pipelineStage || "new"] || "Активный этап"} · {item.nextAction || "Проверить карточку"}</p></div><span>Открыть →</span></button>)}</div>}
  </>;
}

function Candidates({ candidates, archive, branches, onRefreshArchive, onOpen, onNew, resolveProfile, canCreate }) {
  const [source, setSource] = useState("current");
  const [search, setSearch] = useState(""); const [stage, setStage] = useState("active"); const [profileId, setProfileId] = useState("all"); const [branchId, setBranchId] = useState("all");
  const [compareIds, setCompareIds] = useState([]);
  const active = new Set(["new", "assignment", "interview", "decision", "offer"]);
  const profileFor = (item) => item.profileDefinition || resolveProfile(item.profileId);
  if (canCreate && source === "legacy") return <><div className="eh-source-tabs"><button type="button" onClick={() => setSource("current")}>Текущая воронка</button><button type="button" aria-current="page">Исторические результаты ({archive.items?.length || 0})</button></div><LegacyArchive archive={archive} branches={branches} onRefresh={onRefreshArchive} /></>;
  const filtered = candidates.filter((candidate) => {
    const profile = profileFor(candidate); const current = candidate.pipelineStage || "new";
    const matchesStage = canCreate
      ? (stage === "archived" ? Boolean(candidate.archivedAt) : !candidate.archivedAt && (stage === "all" || (stage === "active" ? active.has(current) : current === stage)))
      : !candidate.archivedAt;
    return profile && (!search || `${candidate.name} ${candidate.email} ${profile.name}`.toLowerCase().includes(search.toLowerCase())) && (profileId === "all" || candidate.profileId === profileId) && (branchId === "all" || candidate.branchId === branchId) && matchesStage;
  });
  const profiles = [...new Map(candidates.map((item) => [item.profileId, profileFor(item)?.name]).filter(([, name]) => name)).entries()];
  const overdue = canCreate ? candidates.filter((item) => (branchId === "all" || item.branchId === branchId) && !item.archivedAt && item.nextActionAt && new Date(item.nextActionAt) < new Date() && active.has(item.pipelineStage || "new")).length : 0;
  const compared = compareIds.map((id) => candidates.find((item) => item.id === id)).filter(Boolean);
  const comparisonCandidate = (item) => {
    const p = profileFor(item);
    const matrix = buildDecisionMatrix(p, item);
    return { ...item, evidenceComplete: matrix.raters.length >= 2 };
  };
  const canAddToComparison = (item) => comparisonCandidate(item).evidenceComplete
    && (!compared.length || canCompareCandidates(comparisonCandidate(compared[0]), comparisonCandidate(item)));
  const toggleCompare = (item) => setCompareIds((items) => items.includes(item.id) ? items.filter((id) => id !== item.id) : items.length < 4 && canAddToComparison(item) ? [...items, item.id] : items);
  const visibleStages = stage === "all" ? PIPELINE_STAGES : stage === "active" ? PIPELINE_STAGES.filter(([id]) => active.has(id)) : PIPELINE_STAGES.filter(([id]) => id === stage);
  return <>
    {canCreate && <div className="eh-source-tabs"><button type="button" aria-current="page">Текущая воронка ({candidates.filter((item) => !item.archivedAt).length})</button><button type="button" onClick={() => setSource("legacy")}>Исторические результаты ({archive.items?.length || 0})</button></div>}
    <div className="eh-toolbar"><div><h2>{canCreate ? "Кандидаты" : "Назначенные оценки"}</h2><p>{canCreate ? `${filtered.length} в выборке · ${overdue} просроченных действий` : `${filtered.length} форм · CRM и исторические тесты скрыты до вашей submit`}</p></div>{canCreate && <button type="button" className="eh-btn eh-btn-primary" onClick={onNew}>Добавить кандидата</button>}</div>
    <div className={`eh-panel eh-crm-filters ${canCreate ? "" : "eh-crm-filters-blind"}`}><div><label className="eh-label" htmlFor="candidate-search">Поиск</label><input id="candidate-search" className="eh-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, email или должность" /></div>{canCreate && <div><label className="eh-label" htmlFor="candidate-stage">Этап</label><select id="candidate-stage" className="eh-select" value={stage} onChange={(event) => setStage(event.target.value)}><option value="active">Активные</option><option value="all">Все текущие</option><option value="archived">Архив карточек</option>{PIPELINE_STAGES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></div>}<div><label className="eh-label" htmlFor="candidate-role">Должность</label><select id="candidate-role" className="eh-select" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="all">Все должности</option>{profiles.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></div>{canCreate && branches.length > 1 && <div><label className="eh-label" htmlFor="candidate-branch-filter">Филиал</label><select id="candidate-branch-filter" className="eh-select" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="all">Все доступные</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>}</div>
    {canCreate && compared.length >= 2 && <section className="eh-panel eh-compare"><div className="eh-role-head"><div><span className="eh-family">Одинаковые должность, версия и филиал</span><h2>Сравнение доказательств</h2></div><button type="button" className="eh-btn eh-btn-ghost" onClick={() => setCompareIds([])}>Очистить</button></div><div className="eh-compare-grid">{compared.map((item) => { const p = profileFor(item); const matrix = buildDecisionMatrix(p, item); const sample = methodEvidenceSummary(matrix, "work_sample"); const interview = methodEvidenceSummary(matrix, "structured_interview"); const range = (summary) => summary.minimum == null ? "нет данных" : `${summary.minimum}–${summary.maximum} / 5 · расхождений: ${summary.disagreements}`; return <article key={item.id}><strong>{item.name}</strong><span>{p.name}</span><b>{matrix.raters.length} оценщика</b><small>Рабочая проба: {range(sample)}</small><small>Интервью: {range(interview)}</small><button type="button" className="eh-btn eh-btn-secondary" onClick={() => onOpen(item)}>Открыть матрицу</button></article>; })}</div><p className="eh-helper">В сравнение попадают только две полные submitted-оценки. Диапазоны не подменяют факты общим баллом.</p></section>}
    {!filtered.length ? <div className="eh-empty"><h3>Кандидаты не найдены</h3><p>{canCreate ? "Измените фильтры или создайте новую оценку." : "Измените фильтры или дождитесь назначения карточки."}</p>{canCreate && <button type="button" className="eh-btn eh-btn-primary" onClick={onNew}>Выбрать должность</button>}</div> : !canCreate ? <div className="eh-candidates">{filtered.map((candidate) => { const profile = profileFor(candidate); const result = calculateAssessment(profile, candidate.interviewRatings, candidate.workSampleRatings); return <button type="button" className="eh-candidate eh-candidate-button" key={candidate.id} onClick={() => onOpen(candidate)}><div><strong>{candidate.name}</strong><p>{profile.name} · {candidate.currentRaterSubmittedAt ? "ваша оценка зафиксирована" : `ваша форма заполнена на ${result.completion}%`}</p></div><span>{candidate.currentRaterSubmittedAt ? "Открыть →" : "Оценить →"}</span></button>; })}</div> : stage === "archived" ? <div className="eh-candidates">{filtered.map((candidate) => <button type="button" className="eh-candidate eh-candidate-button" key={candidate.id} onClick={() => onOpen(candidate)}><div><strong>{candidate.name}</strong><p>{profileFor(candidate)?.name} · данные сохранены</p></div><span>Открыть →</span></button>)}</div> : <div className="eh-pipeline-board">{visibleStages.map(([id,label]) => { const rows = filtered.filter((item) => (item.pipelineStage || "new") === id); return <section className="eh-pipeline-column" key={id}><header><strong>{label}</strong><span>{rows.length}</span></header>{rows.length ? rows.map((candidate) => { const profile = profileFor(candidate); const result = calculateAssessment(profile, candidate.interviewRatings, candidate.workSampleRatings); const readiness = decisionReadiness(profile, candidate, 2); const isOverdue = candidate.nextActionAt && new Date(candidate.nextActionAt) < new Date(); const selected = compareIds.includes(candidate.id); const comparisonAllowed = canAddToComparison(candidate); return <article className={`eh-pipeline-card ${selected ? "is-selected" : ""}`} key={candidate.id}><div className="eh-card-select"><label title={comparisonAllowed ? "" : "Сравнение доступно после двух полных submitted-оценок одной должности, версии и филиала"}><input type="checkbox" checked={selected} disabled={!selected && (compareIds.length >= 4 || !comparisonAllowed)} onChange={() => toggleCompare(candidate)} /> Сравнить</label><small>{branchById(candidate.branchId).name}</small></div><strong>{candidate.name}</strong><span>{profile.name}</span><small>Комиссия: {readiness.completeRaters} из {readiness.minimumRaters} оценок</small><small>Ваша форма: {result.completion}%</small>{candidate.candidateSubmittedAt && <small>Ответ кандидата получен</small>}{candidate.nextAction && <small className={isOverdue ? "is-overdue" : ""}>{candidate.nextAction}{candidate.nextActionAt ? ` · ${new Date(candidate.nextActionAt).toLocaleDateString("ru-RU")}` : ""}</small>}<button type="button" className="eh-btn eh-btn-secondary" onClick={() => onOpen(candidate)}>Открыть</button></article>; }) : <p>Нет кандидатов</p>}</section>; })}</div>}
  </>;
}

const LEGACY_FIELDS = [
  ["candidate_email", "Email"], ["candidate_phone", "Телефон"], ["candidate_city", "Город"],
  ["position_name", "Должность"], ["recommended_position", "Рекомендованная роль"],
  ["total_score", "Итоговый балл"], ["score", "Балл"], ["level", "Уровень"],
];

function LegacyResultDetail({ item }) {
  const [state, setState] = useState({ loading: false, loaded: false, raw: null, error: "" });
  const load = async (event) => {
    if (!event.currentTarget.open || state.loading || state.loaded) return;
    setState({ loading: true, loaded: false, raw: null, error: "" });
    try {
      const raw = await getLegacyResultDetail(item.table, item.sourceId);
      setState({ loading: false, loaded: true, raw, error: "" });
    } catch (reason) {
      setState({ loading: false, loaded: false, raw: null, error: reason?.message || "Не удалось загрузить результат" });
    }
  };
  const raw = state.raw || item.summary || {};
  const visibleFields = LEGACY_FIELDS.map(([key, label]) => [label, raw?.[key]]).filter(([, value]) => value !== null && value !== undefined && value !== "");
  const report = raw?.report || raw?.summary || raw?.analysis || raw?.recommendation || "";
  return <details style={{ marginTop: 14 }} onToggle={load}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>{item.label} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ru-RU") : "без даты"}</summary>
    {state.loading && <p className="eh-helper">Загружаем полный исторический результат…</p>}
    {state.error && <div role="alert" className="eh-callout" style={{ marginTop: 10 }}>{state.error}</div>}
    {state.loaded && <>{visibleFields.length > 0 && <div className="eh-card-meta">{visibleFields.map(([label, value]) => <span className="eh-chip" key={label}>{label}: {String(value)}</span>)}</div>}<pre className="eh-legacy-report">{report ? (typeof report === "string" ? report : JSON.stringify(report, null, 2)) : JSON.stringify(raw, null, 2)}</pre></>}
  </details>;
}

function LegacyArchive({ archive, branches, onRefresh }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  if (archive.loading) return <div className="eh-empty">Загружаем прежние результаты…</div>;
  if (archive.error) return <div className="eh-panel"><h2>Не удалось открыть архив</h2><p>{archive.error}</p><p className="eh-helper">Обновите страницу или войдите заново. Старые данные остаются в базе без изменений.</p></div>;
  const query = search.trim().toLowerCase();
  const items = archive.items.filter((item) => (type === "all" || item.type === type) && (!query || `${item.candidateName} ${item.email} ${item.phone} ${item.label}`.toLowerCase().includes(query)));
  const peopleMap = new Map();
  items.forEach((item) => {
    const phoneKey = String(item.phone || "").replace(/\D/g, "");
    const stableIdentity = item.email?.trim().toLowerCase() || item.candidateKey || (phoneKey.length >= 10 ? phoneKey : "");
    const key = stableIdentity || `unlinked:${item.id}`;
    const person = peopleMap.get(key) || { key, name: item.candidateName, email: item.email, phone: item.phone, branchId: item.branchId, possibleDuplicate: !stableIdentity, results: [] };
    person.results.push(item); peopleMap.set(key, person);
  });
  const people = [...peopleMap.values()].sort((a, b) => new Date(b.results[0]?.createdAt || 0) - new Date(a.results[0]?.createdAt || 0));
  const types = [...new Map(archive.items.map((item) => [item.type, item.label])).entries()];
  return <>
    <div className="eh-toolbar"><div><h2>Исторические результаты</h2><p>{peopleMap.size} кандидатов · {archive.items.length} сохранённых результатов</p></div><div className="eh-actions"><button type="button" className="eh-btn eh-btn-secondary" onClick={onRefresh}>Обновить</button><div className="eh-search"><label className="eh-label" htmlFor="legacy-search">Найти кандидата</label><input id="legacy-search" className="eh-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, email или телефон" /></div><div><label className="eh-label" htmlFor="legacy-type">Результат</label><select id="legacy-type" className="eh-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Все результаты</option>{types.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></div></div>
    <div className="eh-callout" style={{ marginBottom: 18 }}>Все прежние данные сохранены только для истории. Их старые баллы, проценты соответствия и личностные интерпретации не подтверждены для решений о найме и не входят в новую оценку.</div>
    {archive.warnings.length > 0 && <div className="eh-callout" style={{ marginBottom: 18 }}>Часть таблиц временно недоступна: {archive.warnings.map((item) => item.table).join(", ")}.</div>}
    {!people.length ? <div className="eh-empty"><h3>Ничего не найдено</h3><p>Измените поиск или фильтр методики.</p></div> : <div className="eh-candidates">{people.map((person) => <article className="eh-candidate" key={person.key} style={{ alignItems: "flex-start" }}><div style={{ minWidth: 0, width: "100%" }}><span className="eh-family">Историческая карточка · {person.branchId ? branchById(person.branchId).name : "Филиал не определён"}</span><h3 style={{ marginTop: 8 }}>{person.name}</h3><p>{person.email || "Email не указан"}{person.phone ? ` · ${person.phone}` : ""}</p>{person.possibleDuplicate && <p className="eh-helper">Нет устойчивого идентификатора: результат оставлен отдельной записью и не объединён только по имени.</p>}<div className="eh-card-meta">{person.results.map((item) => <span className="eh-chip" key={item.id}>{item.label} ✓</span>)}</div><details className="eh-next-step" style={{ marginTop: 14 }}><summary>Как использовать безопасно</summary><p>Если кандидат снова рассматривается на роль, создайте новую карточку и дайте актуальную рабочую пробу и структурированное интервью по одинаковым критериям. Не переносите старый вердикт автоматически.</p></details>{person.results.map((item) => <LegacyResultDetail key={item.id} item={item} />)}</div></article>)}</div>}
  </>;
}

function Method({ account, onSignOut }) {
  return <article className="eh-method">
    {account && <div className="eh-panel" style={{ marginBottom: 20 }}><span className="eh-family">Учётная запись</span><h2 style={{ margin: "8px 0" }}>{account.email}</h2><button type="button" className="eh-btn eh-btn-ghost" onClick={onSignOut}>Выйти из кабинета</button></div>}
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Стандарт EvidenceHire</p><h1>Как система поддерживает обоснованный найм</h1>
    <div className="eh-callout">Платформа стандартизирует процесс, но валидность должна подтверждаться для конкретной должности, организации и способа использования. Название метода или его популярность не являются доказательством.</div>
    <section><h2>1. Анализ работы</h2><p>До оценки фиксируются критичные задачи, рабочие продукты, последствия ошибки и требования, необходимые именно на входе. Профиль пересматривается при существенном изменении роли.</p></section>
    <section><h2>2. Репрезентативная рабочая проба</h2><p>Кандидат выполняет задачу, близкую к реальной работе. Проверяющий использует заранее заданную рубрику и не подменяет качество решения общим впечатлением.</p></section>
    <section><h2>3. Структурированное интервью</h2><p>Основные вопросы и порядок одинаковы для всех кандидатов на должность. Оценки 1, 3 и 5 привязаны к заранее описанным наблюдаемым признакам ответа. Дополнительные вопросы разрешены только для уточнения фактов.</p></section>
    <section><h2>4. Независимые оценки</h2><p>Интервьюеры сначала оценивают кандидата самостоятельно. Комиссия обсуждает факты при расхождении, а не ищет компромиссный балл.</p></section>
    <section><h2>5. Локальная проверка</h2><p>Система должна связывать оценки с заранее определёнными KPI через 30, 60 и 90 дней, проверять надёжность шкал, согласие оценщиков и различия в прохождении этапов.</p></section>
    <section><h2>Ограничения</h2><ul><li>Не используйте личностные ярлыки или выводы о здоровье.</li><li>Не ранжируйте людей по неподтверждённым порогам.</li><li>Не собирайте признаки, не связанные с работой.</li><li>Не раскрывайте предыдущие оценки интервьюеру до независимого выставления баллов.</li></ul></section>
  </article>;
}

function Research({ candidates, resolveProfile }) {
  const summary = summarizeValidation(candidates, resolveProfile, 90);
  return <article className="eh-method">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Качество найма</p><h1>Проверяем прогноз реальной работой</h1>
    <div className="eh-callout">Пока профиль не имеет заранее замороженного плана оценки и минимум 30 сопоставимых наблюдений, система не показывает корреляцию. Каждая должность, версия, школа и определение KPI анализируются отдельно.</div>
    <div className="eh-grid" style={{ marginTop: 20 }}>
      <div className="eh-panel"><span className="eh-family">Все оценки</span><h2 style={{ fontSize: 38, marginBottom: 4 }}>{summary.totalCandidates}</h2><p className="eh-helper">Создано в организации</p></div>
      <div className="eh-panel"><span className="eh-family">Полный процесс</span><h2 style={{ fontSize: 38, marginBottom: 4 }}>{summary.completed}</h2><p className="eh-helper">Заполнены проба и интервью</p></div>
      <div className="eh-panel"><span className="eh-family">90 дней</span><h2 style={{ fontSize: 38, marginBottom: 4 }}>{summary.followedUp}</h2><p className="eh-helper">Зафиксирован результат работы</p></div>
    </div>
    <section><h2>Срезы без смешивания должностей</h2>{!summary.groups.length ? <p>Данных пока нет.</p> : <div className="eh-quality-groups">{summary.groups.map((group) => <div className="eh-panel" key={group.key}><strong>{group.profileName}</strong><p>Версия {group.profileVersion} · {group.branchId === "unassigned" ? "Филиал не указан" : branchById(group.branchId).name}</p><small>{group.candidates} кандидатов · {group.completed} полных оценок · {group.followedUp} наблюдений через 90 дней</small><p className="eh-helper">{group.profileStatus === "validated" ? (group.correlation == null ? "Для расчёта связи нужно минимум 30 сопоставимых пар с одним заранее определённым результатом." : `Наблюдаемая корреляция: ${group.correlation.toFixed(2)}; 95% интервал ${group.confidenceInterval?.[0].toFixed(2)}…${group.confidenceInterval?.[1].toFixed(2)}. Требуется независимая проверка специалистом.`) : "Профиль ещё не валидирован — итоговый коэффициент намеренно не рассчитывается."}</p></div>)}</div>}</section>
    <section><h2>Перед подтверждением профиля</h2><ul><li>Зафиксируйте KPI и период до просмотра результатов.</li><li>Проверьте согласие оценщиков и качество заполнения рубрик.</li><li>Оцените добавочную пользу каждого этапа.</li><li>Проверьте различия в прохождении этапов и альтернативы с меньшим неблагоприятным воздействием.</li><li>Документируйте область применения и новую версию профиля.</li></ul></section>
  </article>;
}

export default function HiringPlatform() {
  const [auth, setAuth] = useState({ loading: true, user: null, membership: null, demo: false, error: "" });
  const [view, setView] = useState("today");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [customProfiles, setCustomProfiles] = useState([]);
  const [candidate, setCandidate] = useState(null);
  // Демонстрационный режим намеренно не сохраняет персональные данные в браузере.
  // Production-хранилище подключается через evidence_hiring_schema.sql и Supabase Auth.
  const [candidates, setCandidates] = useState([]);
  const [legacyArchive, setLegacyArchive] = useState({ loading: true, items: [], warnings: [], error: "" });
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [ratingState, setRatingState] = useState("idle");
  const [dirtyOutcomeDays, setDirtyOutcomeDays] = useState(() => new Set());
  const editVersionRef = useRef(0);

  const refreshLegacyArchive = async () => {
    setLegacyArchive((current) => ({ ...current, loading: true, error: "" }));
    try {
      const legacy = await listLegacyResults();
      setLegacyArchive({ loading: false, items: legacy.items || [], warnings: legacy.warnings || [], error: "" });
    } catch (reason) {
      setLegacyArchive((current) => ({ ...current, loading: false, error: reason?.message || "Ошибка архива" }));
    }
  };

  const refreshAssessments = async () => {
    if (!auth.user || !auth.membership) return;
    const startEditVersion = editVersionRef.current;
    const items = await listAssessments(auth.membership.organization_id, auth.user.id);
    if (!refreshCanApply(startEditVersion, editVersionRef.current)) return;
    setCandidates(items);
    setCandidate((current) => current ? (items.find((item) => item.id === current.id) || current) : current);
  };

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
    if (!["dirty", "error", "saving"].includes(saveState) && ratingState !== "saving") return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState, ratingState]);
  useEffect(() => {
    if (!auth.user || !auth.membership) return undefined;
    const timer = window.setInterval(() => {
      if (!["dirty", "error", "saving"].includes(saveState)) refreshAssessments().catch(() => {});
      if (["owner", "admin"].includes(auth.membership.role)) listLegacyResults().then((legacy) => setLegacyArchive({ loading: false, items: legacy.items || [], warnings: legacy.warnings || [], error: "" })).catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, [auth.user, auth.membership, saveState]);
  const allProfiles = useMemo(() => {
    const latest = new Map(JOB_PROFILES.map((item) => [item.id, item]));
    [...customProfiles].reverse().forEach((item) => latest.set(item.id, item));
    return [...latest.values()];
  }, [customProfiles]);
  const accessibleBranches = useMemo(() => {
    if (auth.demo || auth.membership?.role === "owner") return BRANCHES;
    if (!auth.membership) return [];
    const ids = new Set([auth.membership.branch_id, ...(auth.membership.branch_ids || [])].filter(Boolean).map((id) => id === "jobs_main" ? "jobs_design" : id));
    return BRANCHES.filter((branch) => ids.has(branch.id));
  }, [auth.demo, auth.membership]);
  const selectableProfiles = useMemo(() => {
    if (auth.demo || auth.membership?.role === "owner") return allProfiles;
    const schools = new Set(accessibleBranches.map((branch) => branch.school));
    return allProfiles.filter((item) => item.school === "all" || schools.has(item.school));
  }, [auth.demo, auth.membership?.role, accessibleBranches, allProfiles]);
  const resolveProfile = (id) => allProfiles.find((item) => item.id === id) || null;
  const canCreateCandidates = auth.demo || ["owner", "admin"].includes(auth.membership?.role);
  const profile = candidate ? (candidate.profileDefinition || resolveProfile(candidate.profileId)) : selectedProfile;
  const replaceCandidate = (next) => { setCandidate(next); setCandidates((items) => items.map((item) => item.id === next.id ? next : item)); };
  const updateCandidate = (next) => { editVersionRef.current += 1; setSaveError(""); setSaveState("dirty"); replaceCandidate(next); };
  const updateOutcome = (days, outcome) => {
    setDirtyOutcomeDays((current) => new Set([...current, days]));
    updateCandidate({ ...candidate, outcomes: { ...(candidate.outcomes || {}), [days]: outcome } });
  };
  const navigate = (next) => {
    if (saveState === "saving" || ratingState === "saving") { window.alert("Дождитесь завершения сохранения."); return; }
    if (candidate && ["dirty", "error"].includes(saveState) && !window.confirm("Есть несохранённые изменения. Покинуть оценку?")) return;
    setSaveState("idle"); setSaveError(""); setDirtyOutcomeDays(new Set()); setView(next); setSelectedProfile(null); setCandidate(null); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  let content;
  if (auth.loading) return <div className="eh-shell"><main className="eh-main"><div className="eh-empty">Проверяем защищённую сессию…</div></main></div>;
  if (!auth.user && !auth.demo) return <Login onReady={loadAccount} onDemo={() => { setLegacyArchive({ loading: false, items: [], warnings: [], error: "" }); setAuth({ loading: false, user: null, membership: null, demo: true, error: "" }); }} />;

  const persistCandidate = async (requestedOutcomeDays = [...dirtyOutcomeDays]) => {
    if (!candidate) return false;
    const snapshot = candidate;
    const capturedVersion = editVersionRef.current;
    const daysToSave = [...new Set(requestedOutcomeDays)].filter((days) => snapshot.outcomes?.[days]);
    const initiallyRemainingDays = [...dirtyOutcomeDays].filter((days) => !daysToSave.includes(days));
    if (auth.demo) {
      if (capturedVersion === editVersionRef.current) setDirtyOutcomeDays((current) => new Set([...current].filter((days) => !daysToSave.includes(days))));
      setSaveError("");
      setSaveState(initiallyRemainingDays.length ? "dirty" : "saved");
      if (!initiallyRemainingDays.length) setTimeout(() => setSaveState((current) => current === "saved" ? "idle" : current), 1200);
      return true;
    }
    setSaveState("saving");
    setSaveError("");
    try {
      await saveCardThenOutcomes({
        saveCard: () => saveAssessment(auth.membership.organization_id, auth.user.id, snapshot, { manageAssessment: ["owner", "admin"].includes(auth.membership.role) }),
        onCardSaved: (saved) => {
          setCandidate((current) => current?.id === snapshot.id ? { ...current, updatedAt: saved.updatedAt || current.updatedAt, referenceOriginalNotes: saved.referenceOriginalNotes } : current);
          setCandidates((items) => items.map((item) => item.id === snapshot.id ? { ...item, updatedAt: saved.updatedAt || item.updatedAt, referenceOriginalNotes: saved.referenceOriginalNotes } : item));
        },
        outcomeDays: daysToSave,
        saveCheckpoint: (days) => saveOutcome(auth.membership.organization_id, auth.user.id, snapshot.id, days, snapshot.outcomes[days]),
      });
      const changedWhileSaving = capturedVersion !== editVersionRef.current;
      if (!changedWhileSaving) setDirtyOutcomeDays((current) => new Set([...current].filter((days) => !daysToSave.includes(days))));
      const stillDirty = changedWhileSaving || initiallyRemainingDays.length > 0;
      setSaveState(stillDirty ? "dirty" : "saved");
      if (!stillDirty) setTimeout(() => setSaveState((current) => current === "saved" ? "idle" : current), 1500);
      return true;
    } catch (reason) {
      setSaveError(reason?.message || "Не удалось сохранить изменения.");
      setSaveState("error");
      return false;
    }
  };

  if (candidate && !profile) content = <div className="eh-panel"><h1>Профиль должности недоступен</h1><p>Карточка сохранена, но её версия профиля не найдена. Обратитесь к владельцу — система не будет подставлять другую должность автоматически.</p><button type="button" className="eh-btn eh-btn-ghost" onClick={() => navigate("candidates")}>К кандидатам</button></div>;
  else if (candidate && profile) content = <Assessment candidate={candidate} profile={profile} onChange={updateCandidate} onChangeOutcome={updateOutcome} onBack={() => navigate("candidates")} onSave={persistCandidate} saveState={saveState} saveError={saveError} ratingState={ratingState} demo={auth.demo} onCreateInvite={async () => { const link = await createCandidateInvite(candidate.id); const refreshed = await listAssessments(auth.membership.organization_id, auth.user.id); setCandidates(refreshed); setCandidate(refreshed.find((item) => item.id === candidate.id) || null); return link; }} onSetCandidateModules={async (modules) => { if (auth.demo) { replaceCandidate({ ...candidate, candidateModules: modules }); return; } await setAssessmentCandidateModules(candidate.id, modules); const refreshed = await listAssessments(auth.membership.organization_id, auth.user.id); setCandidates(refreshed); setCandidate(refreshed.find((item) => item.id === candidate.id) || null); }} canInvite={!auth.demo && ["owner","admin"].includes(auth.membership?.role)} canReviewSubmittedWithoutOwnRating={auth.demo || auth.membership?.role === "owner"} onSubmitRating={async () => { setRatingState("saving"); try { if (auth.demo) { const now = new Date().toISOString(); const ratings = {}, notes = {}; Object.entries(candidate.interviewRatings).forEach(([id, value]) => { ratings[`structured_interview:${id}`] = value; }); Object.entries(candidate.workSampleRatings).forEach(([id, value]) => { ratings[`work_sample:${id}`] = value; }); Object.entries(candidate.interviewNotes).forEach(([id, value]) => { notes[`structured_interview:${id}`] = value; }); notes["work_sample:reviewer_notes"] = candidate.workSampleNotes; notes["work_sample:observer_attestation"] = "confirmed"; const completed = { ...candidate, currentRaterSubmittedAt: now, raterEvidence: [{ raterId: "demo", submittedAt: now, ratings, notes }, { raterId: "demo-second", submittedAt: now, ratings, notes }] }; setCandidate(completed); setCandidates((items) => items.map((item) => item.id === completed.id ? completed : item)); setSaveState("saved"); } else { const saved = await persistCandidate(); if (!saved) throw new Error("save-failed"); await submitAssessmentEvidence(candidate.id); const refreshed = await listAssessments(auth.membership.organization_id, auth.user.id); setCandidates(refreshed); setCandidate(refreshed.find((item) => item.id === candidate.id) || null); setSaveState("saved"); } setRatingState("saved"); } catch { setRatingState("error"); setSaveState("error"); } }} onAddNote={async (body) => { const created = auth.demo ? { id: crypto.randomUUID(), body, created_at: new Date().toISOString() } : await addCandidateNote(auth.membership.organization_id, auth.user.id, candidate.id, body); replaceCandidate({ ...candidate, notes: [created, ...(candidate.notes || [])] }); }} canManageOutcomes={auth.demo || ["owner","admin"].includes(auth.membership?.role)} canManageCrm={auth.demo || ["owner","admin"].includes(auth.membership?.role)} canArchive={auth.demo || ["owner","admin"].includes(auth.membership?.role)} canDecide={auth.demo || ["owner","admin"].includes(auth.membership?.role)} onSaveOutcome={async (days) => persistCandidate([days])} onArchive={async () => { if (["dirty", "error", "saving"].includes(saveState) || ratingState === "saving") { window.alert("Сначала дождитесь сохранения всех изменений. Карточка не будет архивирована раньше подтверждения сервером."); return; } if (!window.confirm("Убрать карточку в архив? Все ответы, оценки и заметки сохранятся.")) return; try { if (!auth.demo) await archiveAssessment(candidate.id); setCandidates((items) => items.map((item) => item.id === candidate.id ? { ...item, archivedAt: new Date().toISOString(), archiveReason: "Закрыто из активной воронки" } : item)); setCandidate(null); setView("candidates"); } catch { setSaveState("error"); } }} onRestore={async () => { try { if (!auth.demo) await restoreAssessment(candidate.id); const restored = { ...candidate, archivedAt: "", archiveReason: "" }; setCandidates((items) => items.map((item) => item.id === candidate.id ? restored : item)); setCandidate(restored); } catch { setSaveState("error"); } }} />;
  else if (selectedProfile) content = <CandidateForm profile={selectedProfile} branches={accessibleBranches.filter((branch) => selectedProfile.school === "all" || branch.school === selectedProfile.school)} canApprove={auth.demo || auth.membership?.role === "owner"} onApprove={async (review) => { const promoted = auth.demo ? { ...selectedProfile, version: (selectedProfile.version || 1) + 1, status: "pilot", scoringPlan: null, jobAnalysis: { ...review, reviewedAt: new Date().toISOString(), status: "demo" } } : await promoteProfileToPilot(auth.membership.organization_id, auth.user.id, selectedProfile, review); setCustomProfiles((items) => [promoted, ...items.filter((item) => item.id !== promoted.id)]); setSelectedProfile(promoted); }} onCancel={() => setSelectedProfile(null)} onCreate={async (created) => { const stored = auth.demo ? { ...created, profileDefinition: selectedProfile } : await createAssessment(auth.membership.organization_id, auth.user.id, created, selectedProfile); setCandidates((items) => [stored, ...items]); setCandidate(stored); }} />;
  else if (view === "today") content = <Today candidates={candidates} onOpen={setCandidate} onNew={() => navigate("profiles")} onProfiles={() => navigate("profiles")} onCandidates={() => navigate("candidates")} canCreate={canCreateCandidates} canApproveProfiles={auth.demo || auth.membership?.role === "owner"} pilotProfileCount={selectableProfiles.filter((item) => ["pilot", "validated"].includes(item.status)).length} />;
  else if (view === "candidates") content = <Candidates candidates={candidates} archive={legacyArchive} branches={accessibleBranches} onRefreshArchive={refreshLegacyArchive} onOpen={setCandidate} onNew={() => navigate("profiles")} resolveProfile={resolveProfile} canCreate={canCreateCandidates} />;
  else if (view === "quality") content = <Research candidates={candidates.filter((item) => !item.archivedAt)} resolveProfile={resolveProfile} />;
  else if (view === "settings") content = <Method account={auth.user} onSignOut={async () => { await signOut(); setCandidates([]); setAuth({ loading: false, user: null, membership: null, demo: false, error: "" }); }} />;
  else content = <Profiles profiles={selectableProfiles} canCreate={canCreateCandidates} onSelect={setSelectedProfile} />;

  return <div className="eh-shell"><Header view={view} setView={navigate} /><main className="eh-main">{auth.demo && <div className="eh-callout" style={{ marginBottom: 18 }}>Демонстрационный режим: данные существуют только в текущей вкладке и исчезнут после обновления.</div>}{content}</main></div>;
}
