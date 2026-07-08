import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pnoislxcidkfhnkpawpj.supabase.co";
const supabaseAnonKey = "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";

const directClient = createClient(supabaseUrl, supabaseAnonKey);
const AUTH_STORAGE_KEY = "klifton_admin_session";

let apiAuthToken = "";

export function setSupabaseAuthToken(token) {
  apiAuthToken = token || "";
  if (apiAuthToken) localStorage.setItem(AUTH_STORAGE_KEY, apiAuthToken);
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getSupabaseAuthToken() {
  if (apiAuthToken) return apiAuthToken;
  apiAuthToken = localStorage.getItem(AUTH_STORAGE_KEY) || "";
  return apiAuthToken;
}

class ApiQuery {
  constructor(table) {
    this.table = table;
    this.action = null;
    this.columns = "*";
    this.payload = null;
    this.filters = [];
    this.modifiers = {};
    this.options = {};
  }

  select(columns = "*") {
    this.action = "select";
    this.columns = columns;
    return this;
  }

  insert(payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.action = "upsert";
    this.payload = payload;
    this.options = options;
    return this;
  }

  update(payload) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete(options = {}) {
    this.action = "delete";
    this.options = options;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  order(column, options = {}) {
    this.modifiers.order = {
      column,
      ascending: options.ascending !== false,
    };
    return this;
  }

  limit(value) {
    this.modifiers.limit = value;
    return this;
  }

  maybeSingle() {
    this.modifiers.maybeSingle = true;
    return this;
  }

  async execute() {
    if (!this.action) return { data: null, error: { message: "Не указан тип запроса." } };
    try {
      const response = await fetch("/api/supabase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getSupabaseAuthToken() ? { Authorization: `Bearer ${getSupabaseAuthToken()}` } : {}),
        },
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          columns: this.columns,
          payload: this.payload,
          filters: this.filters,
          modifiers: this.modifiers,
          options: this.options,
        }),
      });
      const result = await response.json();
      if (!response.ok && !result.error) {
        return { data: null, error: { message: "Ошибка API Supabase." } };
      }
      return result;
    } catch (error) {
      return this.executeDirectFallback();
    }
  }

  async executeDirectFallback() {
    let query;
    if (this.action === "select") query = directClient.from(this.table).select(this.columns);
    if (this.action === "insert") query = directClient.from(this.table).insert(this.payload);
    if (this.action === "upsert") query = directClient.from(this.table).upsert(this.payload, this.options);
    if (this.action === "update") query = directClient.from(this.table).update(this.payload);
    if (this.action === "delete") query = directClient.from(this.table).delete(this.options);

    this.filters.forEach((filter) => {
      if (filter.type === "eq") query = query.eq(filter.column, filter.value);
    });
    if (this.modifiers.order?.column) {
      query = query.order(this.modifiers.order.column, { ascending: this.modifiers.order.ascending });
    }
    if (Number.isFinite(this.modifiers.limit)) query = query.limit(this.modifiers.limit);
    if (this.modifiers.maybeSingle) query = query.maybeSingle();
    return query;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export const supabase = {
  from(table) {
    return new ApiQuery(table);
  },
};
