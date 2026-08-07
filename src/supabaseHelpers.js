export async function insertWithOptionalOrg(supabase, table, record) {
  const { error } = await supabase.from(table).insert(record);
  return { error: error || null };
}
