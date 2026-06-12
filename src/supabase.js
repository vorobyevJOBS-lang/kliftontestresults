import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://pnoislxcidkfhnkpawpj.supabase.co";

const supabaseAnonKey =
  "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);