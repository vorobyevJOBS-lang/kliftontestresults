import { useEffect, useRef, useState } from "react";
import { getJobProfile } from "./hiring/jobProfiles";
import { getCandidateAssignment, saveCandidateAssignmentDraft, submitCandidateAssignment } from "./hiring/secureRepository";
import { createSerialDraftQueue, hasCurrentConsent } from "./hiring/candidateDraftQueue";
import { QUESTIONS } from "./questions";
import { WORK_PREFERENCE_BANK_SHA256, WORK_PREFERENCE_MODULE, WORK_PREFERENCE_QUESTION_COUNT, WORK_PREFERENCE_SCHEMA, validWorkPreferenceAnswers } from "./hiring/workPreferenceMap";
import "./hiring/hiring.css";

const RESPONSE_SCHEMA = "evidencehire-candidate-v1";
const WORK_SAMPLE_HEADINGS = {
  approach: "[ПЛАН ИЛИ РЕШЕНИЕ]",
  details: "[КЛЮЧЕВЫЕ ДЕТАЛИ]",
  verification: "[ПРОВЕРКА РЕЗУЛЬТАТА]",
};
const SCHOOL_NAMES = {
  klyachka: "Школа рисования «Клячка»",
  jobs: "Школа дизайна JOBS",
  all: "Школы «Клячка» и JOBS",
};
const PRIVACY_NOTICE_VERSION = "2026-08-06-v1";

const emptyResponse = (profile) => ({
  screening: Object.fromEntries((profile.screening || []).map((item) => [item.id, ""])),
  workSample: { approach: "", details: "", verification: "" },
  workPreferenceAnswers: [],
});

function parseSavedResponse(rawResponse, profile) {
  const fallback = emptyResponse(profile);
  if (!rawResponse || !rawResponse.trim()) return fallback;

  try {
    const parsed = JSON.parse(rawResponse);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.schema !== RESPONSE_SCHEMA || typeof parsed.workSample !== "string") throw new Error("legacy-text");

    const screening = { ...fallback.screening };
    for (const item of profile.screening || []) {
      if (typeof parsed.screening?.[item.id] === "string") screening[item.id] = parsed.screening[item.id];
    }
    const pattern = /^\[ПЛАН ИЛИ РЕШЕНИЕ\]\n([\s\S]*?)\n\n\[КЛЮЧЕВЫЕ ДЕТАЛИ\]\n([\s\S]*?)\n\n\[ПРОВЕРКА РЕЗУЛЬТАТА\]\n([\s\S]*)$/;
    const sections = parsed.workSample.match(pattern);
    return {
      screening,
      workPreferenceAnswers: parsed.rolePreferences?.schema === WORK_PREFERENCE_SCHEMA
        && parsed.rolePreferences?.itemBankSha256 === WORK_PREFERENCE_BANK_SHA256
        && Array.isArray(parsed.rolePreferences?.answers)
        ? parsed.rolePreferences.answers.filter((answer) => answer === "A" || answer === "B").slice(0, WORK_PREFERENCE_QUESTION_COUNT)
        : [],
      workSample: sections
        ? { approach: sections[1], details: sections[2], verification: sections[3] }
        : { ...fallback.workSample, approach: parsed.workSample },
    };
  } catch {
    // Earlier versions stored one plain-text answer. Keep it editable instead of losing it.
    return { ...fallback, workSample: { ...fallback.workSample, approach: rawResponse } };
  }
}

function serializeResponse(response) {
  return JSON.stringify({
    schema: RESPONSE_SCHEMA,
    screening: response.screening,
    rolePreferences: {
      schema: WORK_PREFERENCE_SCHEMA,
      itemBankSha256: WORK_PREFERENCE_BANK_SHA256,
      answers: response.workPreferenceAnswers,
    },
    workSample: [
      `${WORK_SAMPLE_HEADINGS.approach}\n${response.workSample.approach}`,
      `${WORK_SAMPLE_HEADINGS.details}\n${response.workSample.details}`,
      `${WORK_SAMPLE_HEADINGS.verification}\n${response.workSample.verification}`,
    ].join("\n\n"),
  });
}

function resolveProfile(assignment) {
  if (assignment.profile_definition) return assignment.profile_definition;
  return getJobProfile(assignment.profile_key);
}

function screeningIsComplete(profile, response) {
  return (profile.screening || []).every((item) => !item.required || response.screening[item.id]?.trim());
}

function workSampleIsComplete(response) {
  return response.workSample.approach.trim().length >= 20 && response.workSample.verification.trim().length > 0;
}

function assignmentSteps(profile, assignment) {
  return [
    ...((profile.screening || []).length ? ["screening"] : []),
    ...((assignment?.candidate_modules || []).includes(WORK_PREFERENCE_MODULE) ? ["preferences"] : []),
    "workSample",
  ];
}

function getSchoolName(profile, assignment) {
  if (assignment.branch_id?.startsWith("jobs")) return SCHOOL_NAMES.jobs;
  if (assignment.branch_id?.startsWith("klyachka")) return SCHOOL_NAMES.klyachka;
  return SCHOOL_NAMES[profile.school] || "Школа";
}

export default function CandidatePortal() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [state, setState] = useState(() => token
    ? { loading: true, assignment: null, profile: null, error: "" }
    : { loading: false, assignment: null, profile: null, error: "Ссылка недействительна." });
  const [response, setResponse] = useState({ screening: {}, workSample: { approach: "", details: "", verification: "" }, workPreferenceAnswers: [] });
  const [step, setStep] = useState(0);
  const [preferenceIndex, setPreferenceIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [draftState, setDraftState] = useState("idle");
  const [validationError, setValidationError] = useState("");
  const editedRef = useRef(false);
  const lastSavedRef = useRef("");
  const latestPayloadRef = useRef("");
  const draftQueueRef = useRef(null);
  const mountedRef = useRef(true);

  if (!draftQueueRef.current) {
    draftQueueRef.current = createSerialDraftQueue((payload) => (
      saveCandidateAssignmentDraft(token, payload, true, PRIVACY_NOTICE_VERSION)
    ));
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const persistDraft = (payload) => {
    latestPayloadRef.current = payload;
    setDraftState("saving");
    return draftQueueRef.current.enqueue(payload).then(() => {
      lastSavedRef.current = draftQueueRef.current.lastSaved();
      if (mountedRef.current && latestPayloadRef.current === payload) setDraftState("saved");
      return true;
    }).catch((reason) => {
      if (mountedRef.current && latestPayloadRef.current === payload) setDraftState("error");
      throw reason;
    });
  };

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    getCandidateAssignment(token).then((assignment) => {
      if (!assignment) throw new Error("not-found");
      const profile = resolveProfile(assignment);
      const restored = parseSavedResponse(assignment.candidate_response || "", profile);
      if (cancelled) return;
      lastSavedRef.current = assignment.candidate_response || "";
      latestPayloadRef.current = assignment.candidate_response || "";
      draftQueueRef.current.initialize(assignment.candidate_response || "");
      setResponse(restored);
      setPreferenceIndex(Math.min(restored.workPreferenceAnswers.length, WORK_PREFERENCE_QUESTION_COUNT - 1));
      setDone(Boolean(assignment.submitted_at));
      setConsent(hasCurrentConsent(assignment, PRIVACY_NOTICE_VERSION));
      const steps = assignmentSteps(profile, assignment);
      const firstIncomplete = steps.findIndex((item) => (
        (item === "screening" && !screeningIsComplete(profile, restored))
        || (item === "preferences" && !validWorkPreferenceAnswers(restored.workPreferenceAnswers))
        || item === "workSample"
      ));
      setStep(Math.max(0, firstIncomplete));
      setState({ loading: false, assignment, profile, error: "" });
    }).catch(() => {
      if (!cancelled) setState({ loading: false, assignment: null, profile: null, error: "Ссылка недействительна, срок её действия истёк или сервис временно недоступен. Запросите новую ссылку у команды найма." });
    });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!state.assignment || done || !consent || !editedRef.current) return undefined;
    const payload = serializeResponse(response);
    latestPayloadRef.current = payload;
    setDraftState("pending");
    const timer = window.setTimeout(() => {
      persistDraft(payload).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [token, response, consent, done, state.assignment]);

  useEffect(() => {
    if (!state.assignment || done || !consent || !editedRef.current) return undefined;
    const payload = serializeResponse(response);
    if (payload === lastSavedRef.current && draftState !== "error") return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [response, consent, done, draftState, state.assignment]);

  const updateScreening = (id, value) => {
    editedRef.current = true;
    setDraftState("idle");
    setValidationError("");
    setResponse((current) => ({ ...current, screening: { ...current.screening, [id]: value } }));
  };

  const updateWorkSample = (field, value) => {
    editedRef.current = true;
    setDraftState("idle");
    setValidationError("");
    setResponse((current) => ({ ...current, workSample: { ...current.workSample, [field]: value } }));
  };

  const updatePreference = (index, value) => {
    editedRef.current = true;
    setDraftState("idle");
    setValidationError("");
    setResponse((current) => {
      const answers = [...current.workPreferenceAnswers];
      answers[index] = value;
      return { ...current, workPreferenceAnswers: answers };
    });
  };

  const goToWorkSample = () => {
    if (!screeningIsComplete(state.profile, response)) {
      setValidationError("Заполните обязательные поля, чтобы перейти к рабочему заданию.");
      return;
    }
    setValidationError("");
    setStep((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToWorkSampleFromPreferences = () => {
    if (!validWorkPreferenceAnswers(response.workPreferenceAnswers)) {
      const firstMissing = QUESTIONS.findIndex((_, index) => !["A", "B"].includes(response.workPreferenceAnswers[index]));
      setPreferenceIndex(Math.max(0, firstMissing));
      setValidationError(`Ответьте на все пары. Осталось: ${WORK_PREFERENCE_QUESTION_COUNT - response.workPreferenceAnswers.filter((answer) => answer === "A" || answer === "B").length}.`);
      return;
    }
    setValidationError("");
    setStep((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!screeningIsComplete(state.profile, response)) {
      setStep(assignmentSteps(state.profile, state.assignment).indexOf("screening"));
      setValidationError("Заполните обязательные короткие вопросы.");
      return;
    }
    if ((state.assignment.candidate_modules || []).includes(WORK_PREFERENCE_MODULE) && !validWorkPreferenceAnswers(response.workPreferenceAnswers)) {
      setStep(assignmentSteps(state.profile, state.assignment).indexOf("preferences"));
      setPreferenceIndex(Math.max(0, QUESTIONS.findIndex((_, index) => !["A", "B"].includes(response.workPreferenceAnswers[index]))));
      setValidationError("Ответьте на все пары карты рабочих предпочтений.");
      return;
    }
    if (!workSampleIsComplete(response)) {
      setValidationError("Добавьте основной ответ не короче 20 символов и опишите, как проверите результат.");
      return;
    }
    if (!consent) {
      setValidationError("Подтвердите согласие на обработку ответа перед отправкой.");
      return;
    }

    setSubmitting(true);
    setValidationError("");
    setState((current) => ({ ...current, error: "" }));
    try {
      const payload = serializeResponse(response);
      await draftQueueRef.current.waitForIdle().catch(() => {});
      await submitCandidateAssignment(token, payload, consent, PRIVACY_NOTICE_VERSION);
      lastSavedRef.current = payload;
      setDone(true);
    } catch {
      setState((current) => ({ ...current, error: "Не удалось отправить ответ. Проверьте соединение или запросите новую ссылку." }));
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading) return <div className="eh-shell"><main className="eh-main"><div className="eh-empty" aria-live="polite">Открываем задание…</div></main></div>;
  if (!state.assignment || !state.profile) return <div className="eh-shell"><main className="eh-main" style={{ maxWidth: 680 }}><div className="eh-panel"><h1>Не удалось открыть задание</h1><p role="alert">{state.error}</p></div></main></div>;

  const { assignment, profile } = state;
  const screening = profile.screening || [];
  const hasScreening = screening.length > 0;
  const steps = assignmentSteps(profile, assignment);
  const hasPreferences = steps.includes("preferences");
  const stepKey = steps[step] || "workSample";
  const totalSteps = steps.length;
  const currentStep = step + 1;
  const preferenceQuestion = QUESTIONS[preferenceIndex];
  const answeredPreferences = response.workPreferenceAnswers.filter((answer) => answer === "A" || answer === "B").length;
  const schoolName = getSchoolName(profile, assignment);
  const expiresAt = assignment.expires_at
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(new Date(assignment.expires_at))
    : "";
  const saveLabel = draftState === "saving"
    ? "Сохраняем…"
    : draftState === "saved"
      ? "Черновик сохранён"
      : draftState === "pending"
        ? "Есть несохранённые изменения"
      : draftState === "error"
        ? "Черновик не сохранился — проверьте соединение"
        : "";

  return <div className="eh-shell">
    <header className="eh-header eh-candidate-header">
      <div className="eh-header-inner">
        <div className="eh-brand"><span className="eh-brand-mark" aria-hidden="true">E</span><span>{schoolName}</span></div>
        <span className="eh-family">Отбор в команду</span>
      </div>
    </header>
    <main className="eh-main" style={{ maxWidth: 780 }}>
      <div className="eh-panel">
        <span className="eh-family">{schoolName}</span>
        <h1 style={{ marginBottom: 8 }}>{profile.name}</h1>
        <p style={{ color: "#647068", lineHeight: 1.6, marginTop: 0 }}>
          Здравствуйте, {assignment.candidate_name}. Здесь вы подготовите материал к рабочей пробе — примерно {profile.workSample.minutes} минут{hasScreening ? "; перед ней — несколько коротких вопросов" : ""}{hasPreferences ? "; дополнительная карта рабочих предпочтений займёт около 45–50 минут" : ""}. Для интерактивных ролей итоговая проба проходит с интервьюером. Когда появится статус «Черновик сохранён», страницу можно закрыть и продолжить позже по этой же персональной ссылке.
        </p>
        {expiresAt && !done && <p className="eh-helper">Персональная ссылка действует до {expiresAt}. Отправьте ответ до этого времени; при необходимости команда найма выдаст новую ссылку.</p>}

        {done ? <div className="eh-empty">
          <h2>Ответ получен</h2>
          <p>Спасибо. Команда школы рассмотрит рабочую пробу вместе с другими материалами. Решение не принимается автоматически только по этому заданию.</p>
        </div> : <>
          <div className="eh-callout">
            Здесь нет «ловушек» и медицинских или личностных диагнозов. Опишите, как вы реально действуете в рабочей ситуации. Не указывайте сведения о здоровье, семье и другие данные, не относящиеся к работе.
          </div>

          {!consent ? <section className="eh-consent-gate" aria-labelledby="consent-heading">
            <h2 id="consent-heading">Перед началом</h2>
            <p>Ответ и черновик начнут сохраняться только после вашего согласия. Итоговое решение принимает работодатель, а не автоматический тест.</p>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, lineHeight: 1.5 }}>
              <input type="checkbox" checked={false} onChange={(event) => { if (event.target.checked) setConsent(true); }} aria-describedby="consent-help" />
              <span id="consent-help">Я согласен(на) на обработку моего ответа для оценки на указанную должность и ознакомлен(а) с <a href={`/privacy?branch=${encodeURIComponent(assignment.branch_id || "")}`} target="_blank" rel="noreferrer">информацией об обработке данных</a>.</span>
            </label>
          </section> : <>
          <p className="eh-helper" style={{ marginTop: 16 }}>Согласие зафиксировано. Для отзыва согласия используйте контакт работодателя на странице обработки данных.</p>
          <div className="eh-progress-line">
            <div
              className="eh-progress-track"
              role="progressbar"
              aria-label="Прогресс выполнения задания"
              aria-valuemin="1"
              aria-valuemax={totalSteps}
              aria-valuenow={currentStep}
            ><span style={{ width: `${currentStep / totalSteps * 100}%` }} /></div>
            <div className="eh-progress-label">
              <span>Шаг {currentStep} из {totalSteps}</span>
              <strong aria-live="polite">{saveLabel}</strong>
            </div>
            {editedRef.current && serializeResponse(response) !== lastSavedRef.current && <button type="button" className="eh-btn eh-btn-ghost" style={{ marginTop: 10 }} disabled={draftState === "saving"} onClick={() => persistDraft(serializeResponse(response)).catch(() => {})}>Сохранить сейчас</button>}
          </div>

          {stepKey === "screening" ? <section aria-labelledby="screening-heading" style={{ marginTop: 24 }}>
            <h2 id="screening-heading" style={{ marginBottom: 8 }}>Короткие вопросы</h2>
            <p style={{ color: "#647068", lineHeight: 1.55, marginTop: 0 }}>Ответьте по существу. Эти сведения нужны, чтобы проверить базовые условия роли до интервью.</p>
            <div className="eh-stack" style={{ marginTop: 20 }}>
              {screening.map((item, index) => {
                const fieldId = `screening-${item.id}`;
                const invalid = Boolean(validationError && item.required && !response.screening[item.id]?.trim());
                return <div key={item.id}>
                  <label className="eh-label" htmlFor={fieldId}>{index + 1}. {item.label}{item.required ? " *" : ""}</label>
                  <textarea
                    id={fieldId}
                    className="eh-textarea"
                    maxLength={800}
                    required={Boolean(item.required)}
                    value={response.screening[item.id] || ""}
                    onChange={(event) => updateScreening(item.id, event.target.value)}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? "candidate-validation" : undefined}
                    placeholder="Ваш ответ"
                  />
                </div>;
              })}
            </div>
            {validationError && <div id="candidate-validation" role="alert" className="eh-callout" style={{ marginTop: 16 }}>{validationError}</div>}
            <button type="button" className="eh-btn eh-btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={goToWorkSample}>Перейти к рабочему заданию</button>
          </section> : stepKey === "preferences" ? <section aria-labelledby="preferences-heading" style={{ marginTop: 24 }}>
            <h2 id="preferences-heading" style={{ marginBottom: 8 }}>Карта рабочих предпочтений</h2>
            <p style={{ color: "#647068", lineHeight: 1.55, marginTop: 0 }}>В каждой паре выберите вариант, который чаще похож на ваш обычный способ работать. Равных по смыслу вариантов может не быть — выберите более близкий. Здесь нет правильных ответов.</p>
            <div className="eh-callout">Это дополнительная гипотеза для разговора, а не экзамен на способности. Результат не даёт проходного балла и сам по себе не является причиной отказа.</div>
            <div className="eh-progress-line" style={{ marginTop: 18 }}>
              <div className="eh-progress-track" role="progressbar" aria-label="Прогресс карты предпочтений" aria-valuemin="0" aria-valuemax={WORK_PREFERENCE_QUESTION_COUNT} aria-valuenow={answeredPreferences}><span style={{ width: `${answeredPreferences / WORK_PREFERENCE_QUESTION_COUNT * 100}%` }} /></div>
              <div className="eh-progress-label"><span>Пара {preferenceIndex + 1} из {WORK_PREFERENCE_QUESTION_COUNT}</span><strong>{answeredPreferences} отвечено</strong></div>
            </div>
            <fieldset className="eh-preference-card">
              <legend>Что вам ближе?</legend>
              <label className={response.workPreferenceAnswers[preferenceIndex] === "A" ? "is-selected" : ""}><input type="radio" name={`preference-${preferenceIndex}`} checked={response.workPreferenceAnswers[preferenceIndex] === "A"} onChange={() => updatePreference(preferenceIndex, "A")} /><span><strong>Вариант А</strong>{preferenceQuestion.a}</span></label>
              <label className={response.workPreferenceAnswers[preferenceIndex] === "B" ? "is-selected" : ""}><input type="radio" name={`preference-${preferenceIndex}`} checked={response.workPreferenceAnswers[preferenceIndex] === "B"} onChange={() => updatePreference(preferenceIndex, "B")} /><span><strong>Вариант Б</strong>{preferenceQuestion.b}</span></label>
            </fieldset>
            {validationError && <div id="candidate-preference-validation" role="alert" className="eh-callout" style={{ marginTop: 16 }}>{validationError}</div>}
            <div className="eh-actions" style={{ marginTop: 18 }}>
              <button type="button" className="eh-btn eh-btn-secondary" disabled={preferenceIndex === 0} onClick={() => { setValidationError(""); setPreferenceIndex((current) => Math.max(0, current - 1)); }}>Назад</button>
              {preferenceIndex < WORK_PREFERENCE_QUESTION_COUNT - 1
                ? <button type="button" className="eh-btn eh-btn-primary" style={{ flex: 1 }} disabled={!response.workPreferenceAnswers[preferenceIndex]} onClick={() => setPreferenceIndex((current) => current + 1)}>Следующая пара</button>
                : <button type="button" className="eh-btn eh-btn-primary" style={{ flex: 1 }} disabled={!response.workPreferenceAnswers[preferenceIndex]} onClick={goToWorkSampleFromPreferences}>Перейти к рабочему заданию</button>}
            </div>
          </section> : <section aria-labelledby="work-sample-heading" style={{ marginTop: 24 }}>
            <h2 id="work-sample-heading" style={{ marginBottom: 8 }}>Подготовка: {profile.workSample.title}</h2>
            <p style={{ color: "#647068", lineHeight: 1.55, marginTop: 0 }}>Нам важны ход мысли, конкретные действия и способ проверки результата. Письменный ответ не оценивается отдельно как тест способностей: на встрече команда проверит решение в одинаковом практическом упражнении.</p>
            <div className="eh-work-prompt"><strong>Ситуация</strong><br />{profile.workSample.prompt}</div>

            <div className="eh-stack" style={{ marginTop: 20 }}>
              <div>
                <label className="eh-label" htmlFor="work-approach">1. Ваш план или решение *</label>
                <textarea
                  id="work-approach"
                  className="eh-textarea"
                  style={{ minHeight: 190 }}
                  maxLength={8000}
                  value={response.workSample.approach}
                  onChange={(event) => updateWorkSample("approach", event.target.value)}
                  placeholder="Опишите последовательность действий и почему выбрали именно её."
                  aria-invalid={Boolean(validationError && response.workSample.approach.trim().length < 20)}
                  aria-describedby="work-approach-help candidate-submit-validation"
                />
                <p id="work-approach-help" className="eh-helper">Основная часть ответа — не менее 20 символов.</p>
              </div>
              <div>
                <label className="eh-label" htmlFor="work-details">2. Ключевые детали, примеры или сообщения</label>
                <textarea
                  id="work-details"
                  className="eh-textarea"
                  maxLength={3000}
                  value={response.workSample.details}
                  onChange={(event) => updateWorkSample("details", event.target.value)}
                  placeholder="Добавьте конкретику, которая поможет понять ваше решение."
                />
              </div>
              <div>
                <label className="eh-label" htmlFor="work-verification">3. Как проверите результат и что сделаете дальше? *</label>
                <textarea
                  id="work-verification"
                  className="eh-textarea"
                  maxLength={3000}
                  value={response.workSample.verification}
                  onChange={(event) => updateWorkSample("verification", event.target.value)}
                  placeholder="Назовите наблюдаемый результат, срок или следующий шаг."
                  aria-invalid={Boolean(validationError && !response.workSample.verification.trim())}
                  aria-describedby="candidate-submit-validation"
                />
              </div>
            </div>

            <p className="eh-helper">Черновик сохраняется автоматически после согласия. После окончательной отправки изменить ответ будет нельзя.</p>

            {(validationError || state.error) && <div id="candidate-submit-validation" role="alert" className="eh-callout" style={{ marginTop: 14 }}>{validationError || state.error}</div>}
            <div className="eh-actions" style={{ marginTop: 18 }}>
              {step > 0 && <button type="button" className="eh-btn eh-btn-secondary" onClick={() => { setValidationError(""); setStep((current) => Math.max(0, current - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Назад</button>}
              <button type="button" className="eh-btn eh-btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={submit}>{submitting ? "Отправляем…" : "Отправить окончательно"}</button>
            </div>
          </section>}
          </>}
        </>}
      </div>
    </main>
  </div>;
}
