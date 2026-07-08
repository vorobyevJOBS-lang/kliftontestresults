import { createClient } from "@supabase/supabase-js";
import { createSessionToken, sha256 } from "./_auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pnoislxcidkfhnkpawpj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ data: null, error: { message: "Method not allowed" } });
    return;
  }

  const login = String(req.body?.login || "").trim();
  const password = String(req.body?.password || "").trim();
  if (!login || !password) {
    res.status(400).json({ data: null, error: { message: "Введите логин и пароль." } });
    return;
  }

  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("login", login)
    .maybeSingle();

  if (error || !data) {
    res.status(401).json({ data: null, error: { message: "Неверный логин или пароль." } });
    return;
  }

  const passwordHash = sha256(password);
  const passwordOk = data.password_hash === passwordHash || data.password === password;
  if (!passwordOk) {
    res.status(401).json({ data: null, error: { message: "Неверный логин или пароль." } });
    return;
  }

  const isSuperAdmin = data.login === "vvvorobyev1991";
  const token = createSessionToken({
    login: data.login,
    branch_id: data.branch_id || null,
    is_super_admin: isSuperAdmin,
  });

  res.status(200).json({
    data: {
      login: data.login,
      branch_id: data.branch_id || null,
      is_super_admin: isSuperAdmin,
      token,
    },
    error: null,
  });
}
