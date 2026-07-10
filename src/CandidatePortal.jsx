import { useEffect, useState } from "react";
import { getJobProfile } from "./hiring/jobProfiles";
import { getCandidateAssignment, submitCandidateAssignment } from "./hiring/secureRepository";
import "./hiring/hiring.css";

export default function CandidatePortal() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [state, setState] = useState(() => token
    ? { loading: true, assignment: null, error: "" }
    : { loading: false, assignment: null, error: "Ссылка недействительна." });
  const [response, setResponse] = useState(""); const [consent, setConsent] = useState(false); const [submitting, setSubmitting] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { if (!token) return undefined; getCandidateAssignment(token).then((assignment) => { if (!assignment) throw new Error("not-found"); setResponse(assignment.candidate_response || ""); setDone(Boolean(assignment.submitted_at)); setState({ loading: false, assignment, error: "" }); }).catch(() => setState({ loading: false, assignment: null, error: "Ссылка недействительна, срок её действия истёк или сервис временно недоступен. Запросите новую ссылку у команды найма." })); return undefined; }, [token]);
  const submit = async () => { setSubmitting(true); try { await submitCandidateAssignment(token, response, consent); setDone(true); } catch { setState((current) => ({ ...current, error: "Не удалось отправить ответ. Проверьте соединение или запросите новую ссылку." })); } finally { setSubmitting(false); } };
  if (state.loading) return <div className="eh-shell"><main className="eh-main"><div className="eh-empty">Открываем задание…</div></main></div>;
  if (!state.assignment) return <div className="eh-shell"><main className="eh-main" style={{ maxWidth: 680 }}><div className="eh-panel"><h1>Не удалось открыть задание</h1><p>{state.error}</p></div></main></div>;
  const profile = state.assignment.profile_definition || getJobProfile(state.assignment.profile_key);
  return <div className="eh-shell"><header className="eh-header"><div className="eh-header-inner"><div className="eh-brand"><span className="eh-brand-mark">E</span><span>EvidenceHire</span></div><span className="eh-family">Задание кандидата</span></div></header><main className="eh-main" style={{ maxWidth: 780 }}>
    <div className="eh-panel"><span className="eh-family">{profile.family}</span><h1>{profile.workSample.title}</h1><p style={{ color: "#647068", lineHeight: 1.6 }}>Здравствуйте, {state.assignment.candidate_name}. Это короткая рабочая проба для роли «{profile.name}». Ожидаемое время — около {profile.workSample.minutes} минут.</p>
      <div className="eh-callout">Оцениваться будет содержание решения по заранее заданным критериям. Не указывайте сведения о здоровье, семье и другие персональные данные, не относящиеся к заданию.</div>
      <div className="eh-work-prompt">{profile.workSample.prompt}</div>
      {done ? <div className="eh-empty"><h2>Ответ получен</h2><p>Спасибо. Команда найма рассмотрит решение по одинаковой для всех кандидатов рубрике.</p></div> : <>
        <label className="eh-label" htmlFor="candidate-response">Ваш ответ</label><textarea id="candidate-response" className="eh-textarea" style={{ minHeight: 260 }} maxLength={20000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Опишите ход решения, ключевые предположения и следующий шаг." />
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, lineHeight: 1.5 }}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Я согласен(на) на обработку этого ответа для проведения оценки на указанную должность, ознакомлен(а) с <a href="/privacy" target="_blank" rel="noreferrer">информацией об обработке данных</a> и понимаю, что решение принимает работодатель.</span></label>
        {state.error && <div role="alert" className="eh-callout" style={{ marginTop: 14 }}>{state.error}</div>}
        <button type="button" className="eh-btn eh-btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={!consent || response.trim().length < 20 || submitting} onClick={submit}>{submitting ? "Отправляем…" : "Отправить ответ"}</button>
      </>}
    </div>
  </main></div>;
}
