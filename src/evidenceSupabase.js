import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ||
  "https://pnoislxcidkfhnkpawpj.supabase.co";

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
