import "./hiring/hiring.css";

const OPERATORS = {
  jobs_design: {
    name: "ИП Воробьев Виталий Владимирович",
    registration: "ИНН 421814013854 · ОГРНИП 318420500051442",
    address: "Красноярск, ул. Ленина, 120",
    email: "krasnoyarsk.jobs@gmail.com",
    scope: "Школа дизайна JOBS",
  },
  klyachka_krsk_center: {
    name: "ИП Воробьев Виталий Владимирович",
    registration: "ИНН 421814013854 · ОГРНИП 318420500051442",
    address: "Красноярск, ул. Ленина, 120",
    email: "uprav.krasnoyarsk@gmail.com",
    scope: "Школа рисования «Клячка» — Центр",
  },
  klyachka_krsk_vzlet: {
    name: "ИП Воробьев Виталий Владимирович",
    registration: "ИНН 421814013854 · ОГРНИП 318420500051442",
    address: "Красноярск, ул. Октябрьская, 6",
    email: "uprav.krasnoyarsk@gmail.com",
    scope: "Школа рисования «Клячка» — Взлётка",
  },
  klyachka_nvkz: {
    name: "ИП Васькина Юлия Андреевна",
    registration: "ИНН 190560032534 · ОГРНИП 326420500011732",
    address: "Новокузнецк, ул. Орджоникидзе, 35",
    email: "julia.vaskina98@mail.ru",
    scope: "Школа рисования «Клячка» — Новокузнецк",
  },
};

function Operator({ operator }) {
  return <div><strong>{operator.scope}</strong><br />{operator.name}<br />{operator.registration}<br />{operator.address}<br /><a href={`mailto:${operator.email}`}>{operator.email}</a></div>;
}

export default function PrivacyPage() {
  const branch = new URLSearchParams(window.location.search).get("branch");
  const selected = OPERATORS[branch];
  const operators = selected ? [selected] : [...new Map(Object.values(OPERATORS).map((item) => [`${item.name}:${item.email}`, item])).values()];
  return <div className="eh-shell"><header className="eh-header eh-candidate-header"><div className="eh-header-inner"><div className="eh-brand"><span className="eh-brand-mark">E</span><span>JOBS · Клячка</span></div><a href="/" style={{ color: "#1f6f4e", fontWeight: 700 }}>На главную</a></div></header><main className="eh-main"><article className="eh-method">
    <p className="eh-kicker" style={{ color: "#1f6f4e", opacity: 1 }}>Информация для кандидата · редакция 2026-08-06-v1</p><h1>Как обрабатываются данные оценки</h1>
    <div className="eh-callout"><strong>{selected ? "Оператор для вашего отбора" : "Операторы системы"}</strong><div className="eh-stack" style={{ marginTop: 10 }}>{operators.map((operator) => <Operator key={`${operator.name}:${operator.email}`} operator={operator} />)}</div></div>
    <section><h2>Цель и состав данных</h2><p>Имя, контакт, ответы на подготовительную часть, наблюдения по рабочей пробе, записи структурированного интервью, рекомендации и решение используются только для рассмотрения кандидатуры на согласованную должность, защиты обоснованности решения и проверки качества процесса найма.</p></section>
    <section><h2>Какие данные не требуются</h2><p>В ответе не нужно указывать сведения о здоровье, семейном положении, религии, политических взглядах и другие данные, не относящиеся к выполнению работы.</p></section>
    <section><h2>Кто имеет доступ</h2><p>Доступ получают только назначенные участники команды найма в пределах филиала и роли. Черновые оценки коллег скрыты до завершения собственной независимой формы. Кандидат не видит внутренние оценки и данные других людей.</p></section>
    <section><h2>Срок хранения и права</h2><p>Базовый срок активного хранения карточки — до 365 дней. После его окончания система исключает карточку из активной работы и переводит её в ограниченный архив; это не равно автоматическому уничтожению. Удаление или обезличивание выполняет оператор по документированной процедуре и требованиям закона. По указанному email можно запросить доступ, исправление, блокирование или удаление данных и отозвать согласие в применимой части.</p></section>
    <section><h2>Автоматизированные решения</h2><p>Система не принимает решение о найме автоматически, не ставит диагнозы и не использует черновой профиль как проходной тест. Оффер или отказ фиксирует уполномоченный руководитель по наблюдаемым рабочим фактам после завершения обязательных этапов.</p></section>
  </article></main></div>;
}
