import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pnoislxcidkfhnkpawpj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLES = [
  ["results", "clifton", "Клифтон", "created_at"],
  ["tools_results", "tools", "Профиль", "created_at"],
  ["rezultat_results", "rezultat", "Опыт", "created_at"],
  ["logis_results", "logis", "Логика", "completed_at"],
  ["sails_results", "sails", "Продажник", "completed_at"],
  ["prim_results", "prim", "Первичный анализ", "created_at"],
];

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const token = bearer(req);
  const authenticated = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const reader = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY || SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await authenticated.auth.getUser(token);
  if (authError || !authData.user) return res.status(401).json({ error: "Нужен вход в EvidenceHire" });

  const { data: membership, error: membershipError } = await authenticated.from("organization_members")
    .select("organization_id, role").eq("user_id", authData.user.id)
    .in("role", ["owner", "admin"]).limit(1).maybeSingle();
  if (membershipError || !membership) return res.status(403).json({ error: "Архив доступен только владельцу или администратору" });

  const batches = await Promise.all(TABLES.map(async ([table, type, label, dateColumn]) => {
    const { data, error } = await reader.from(table).select("*").order(dateColumn, { ascending: false }).limit(1000);
    if (error) return { table, error: error.message, items: [] };
    return { table, items: (data || []).map((raw) => ({
      id: `${table}:${raw.id}`, sourceId: raw.id, table, type, label,
      candidateName: raw.candidate_name || raw.name || "Без имени",
      email: raw.candidate_email || raw.email || "", phone: raw.candidate_phone || raw.phone || "",
      branchId: raw.branch_id || "", createdAt: raw[dateColumn] || raw.created_at || raw.completed_at || null, raw,
    })) };
  }));
  return res.status(200).json({
    organizationId: membership.organization_id,
    items: batches.flatMap((batch) => batch.items),
    warnings: batches.filter((batch) => batch.error).map(({ table, error }) => ({ table, error })),
  });
}
