class ApiQuery {
  constructor(table) {
    this.table = table;
    this.action = null;
    this.payload = null;
  }

  insert(payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  async execute() {
    if (this.action !== "insert") return { data: null, error: { message: "Эта операция больше не поддерживается." } };
    try {
      const response = await fetch("/api/supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: this.table, action: this.action, payload: this.payload }),
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error || { message: "Не удалось сохранить результат." } };
      return result;
    } catch {
      return { data: null, error: { message: "Нет связи с сервером. Проверьте интернет и повторите отправку." } };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export function setSupabaseAuthToken() {
  // Legacy custom sessions are intentionally disabled. Kept as a no-op so the
  // archived Admin source can still be inspected without becoming an auth path.
}

export const supabase = {
  from(table) {
    return new ApiQuery(table);
  },
};
