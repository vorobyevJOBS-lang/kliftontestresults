import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ||
  "https://pnoislxcidkfhnkpawpj.supabase.co";

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Candidate capability links must always use the anonymous database role.
// Keeping this client isolated prevents an HR session in the same browser from
// replacing the link's capability token with the signed-in user's JWT.
export const candidateSupabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storageKey: "evidencehire-candidate-capability",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
