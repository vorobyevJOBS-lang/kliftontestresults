import { createClient } from "@supabase/supabase-js";
import { getBearerToken, verifySessionToken } from "./_auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pnoislxcidkfhnkpawpj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const ALLOWED_TABLES = new Set([
  "admins",
  "results",
  "tools_results",
  "rezultat_results",
  "logis_results",
  "sails_results",
  "prim_results",
  "candidate_profiles",
  "candidate_activity",
]);

const ALLOWED_ACTIONS = new Set(["select", "insert", "upsert", "update", "delete"]);
const PUBLIC_INSERT_TABLES = new Set([
  "results",
  "tools_results",
  "rezultat_results",
  "logis_results",
  "sails_results",
  "prim_results",
]);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

function applyFilters(query, filters = []) {
  return filters.reduce((nextQuery, filter) => {
    if (filter?.type === "eq") return nextQuery.eq(filter.column, filter.value);
    return nextQuery;
  }, query);
}

function applyModifiers(query, modifiers = {}) {
  let nextQuery = query;
  if (modifiers.order?.column) {
    nextQuery = nextQuery.order(modifiers.order.column, {
      ascending: modifiers.order.ascending !== false,
    });
  }
  if (Number.isFinite(modifiers.limit)) nextQuery = nextQuery.limit(modifiers.limit);
  if (modifiers.maybeSingle) nextQuery = nextQuery.maybeSingle();
  return nextQuery;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ data: null, error: { message: "Method not allowed" } });
    return;
  }

  try {
    const { table, action, columns = "*", payload, filters = [], modifiers = {}, options = {} } = req.body || {};

    if (!ALLOWED_TABLES.has(table) || !ALLOWED_ACTIONS.has(action)) {
      res.status(400).json({ data: null, error: { message: "Недопустимый запрос к базе." } });
      return;
    }

    const session = verifySessionToken(getBearerToken(req));
    const isPublicResultInsert = action === "insert" && PUBLIC_INSERT_TABLES.has(table);
    if (!session && !isPublicResultInsert) {
      res.status(401).json({ data: null, error: { message: "Нужен вход в кабинет." } });
      return;
    }
    if (table === "admins" && action !== "select" && !session?.is_super_admin) {
      res.status(403).json({ data: null, error: { message: "Недостаточно прав." } });
      return;
    }
    if (action === "delete" && !session) {
      res.status(401).json({ data: null, error: { message: "Нужен вход в кабинет." } });
      return;
    }

    let query;
    if (action === "select") {
      query = supabase.from(table).select(columns);
      query = applyFilters(query, filters);
      query = applyModifiers(query, modifiers);
    } else if (action === "insert") {
      query = supabase.from(table).insert(payload);
      query = applyModifiers(query, modifiers);
    } else if (action === "upsert") {
      query = supabase.from(table).upsert(payload, options);
      query = applyModifiers(query, modifiers);
    } else if (action === "update") {
      query = supabase.from(table).update(payload);
      query = applyFilters(query, filters);
      query = applyModifiers(query, modifiers);
    } else if (action === "delete") {
      query = supabase.from(table).delete(options);
      query = applyFilters(query, filters);
      query = applyModifiers(query, modifiers);
    }

    const { data, error, count } = await query;
    res.status(error ? 400 : 200).json({ data, error, count });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: error.message || "Server error" } });
  }
}
