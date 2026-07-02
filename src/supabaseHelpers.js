export async function insertWithOptionalOrg(supabase, table, record) {
  const optionalFields = ["branch_id", "applicant_type", "candidate_email", "candidate_phone"];
  const currentRecord = { ...record };

  for (let attempt = 0; attempt <= optionalFields.length; attempt++) {
    const { error } = await supabase.from(table).insert(currentRecord);
    if (!error) return { error: null };

    const message = `${error.message || ""} ${error.details || ""}`.toLowerCase();
    const missingField = optionalFields.find((field) => Object.prototype.hasOwnProperty.call(currentRecord, field) && message.includes(field));
    if (!missingField) return { error };
    delete currentRecord[missingField];
  }

  return { error: { message: "Не удалось сохранить результат после fallback-попыток." } };
}
