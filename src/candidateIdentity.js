export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

export function normalizePersonName(name) {
  return (name || "Без имени").trim().replace(/\s+/g, " ").toLowerCase();
}

export function getCandidateKey({ email, phone, name }) {
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail) return `email:${cleanEmail}`;

  const cleanPhone = normalizePhone(phone);
  if (cleanPhone) return `phone:${cleanPhone}`;

  return `name:${normalizePersonName(name)}`;
}
