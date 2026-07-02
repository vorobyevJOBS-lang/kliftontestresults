export async function insertWithOptionalOrg(supabase, table, record) {
  const { error } = await supabase.from(table).insert(record);
  if (!error) return { error: null };

  const message = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  if (!message.includes("branch_id") && !message.includes("applicant_type")) {
    return { error };
  }

  const { branch_id, applicant_type, ...fallbackRecord } = record;
  return supabase.from(table).insert(fallbackRecord);
}
