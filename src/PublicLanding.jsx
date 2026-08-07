import "./hiring/hiring.css";

export default function PublicLanding() {
  return <div className="eh-shell">
    <header className="eh-header eh-candidate-header">
      <div className="eh-header-inner">
        <div className="eh-brand"><span className="eh-brand-mark" aria-hidden="true">E</span><span>JOBS · Клячка</span></div>
        <a className="eh-btn eh-btn-ghost" href="/hr">Вход для команды</a>
      </div>
    </header>
    <main className="eh-main" style={{ maxWidth: 840 }}>
      <section className="eh-hero" style={{ gridTemplateColumns: "1fr" }}>
        <div className="eh-hero-copy">
          <p className="eh-kicker">Отбор в команду школ</p>
          <h1>Покажите, как вы решаете реальные рабочие задачи</h1>
          <p>Кандидаты проходят оценку только по персональной ссылке от руководителя. В ней уже указаны школа, должность и подходящее рабочее задание.</p>
        </div>
      </section>
      <section className="eh-panel">
        <h2>Как это работает</h2>
        <div className="eh-proof-list">
          <div className="eh-proof"><span>1</span><div><strong>Получите персональную ссылку</strong><br />Запросите её у руководителя или менеджера, с которым общаетесь по вакансии.</div></div>
          <div className="eh-proof"><span>2</span><div><strong>Ответьте на короткие вопросы</strong><br />Только об условиях роли, опыте и готовности к работе.</div></div>
          <div className="eh-proof"><span>3</span><div><strong>Выполните рабочую пробу</strong><br />Черновик сохраняется, а решение принимает команда, не автоматический алгоритм.</div></div>
        </div>
        <div className="eh-callout" style={{ marginTop: 20 }}>Если ссылка не открывается или срок истёк, попросите команду найма создать новую. Не отправляйте ответы и персональные данные в открытых сообщениях.</div>
        <p className="eh-helper" style={{ marginTop: 14 }}><a href="/privacy">Как обрабатываются данные кандидатов</a></p>
      </section>
    </main>
  </div>;
}
