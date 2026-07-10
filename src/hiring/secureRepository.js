import { supabase } from "../evidenceSupabase";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user || null;
}

export async function getMembership(userId) {
  const { data, error } = await supabase.from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCustomProfiles(organizationId) {
  const { data, error } = await supabase.from("job_profiles").select("definition")
    .eq("organization_id", organizationId).neq("status", "archived").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => row.definition).filter(Boolean);
}

export async function createCustomProfile(organizationId, userId, profile) {
  const { error } = await supabase.from("job_profiles").insert({
    organization_id: organizationId,
    slug: profile.id,
    name: profile.name,
    family: profile.family,
    version: profile.version || 1,
    status: "draft",
    definition: profile,
    created_by: userId,
  });
  if (error) throw error;
  return profile;
}

function mapRemoteAssessment(row, currentUserId) {
  const interviewRatings = {}, interviewNotes = {}, workSampleRatings = {};
  let workSampleNotes = "";
  for (const item of (row.assessment_evidence || []).filter((entry) => entry.rater_id === currentUserId)) {
    if (item.method === "structured_interview") {
      if (item.rating != null) interviewRatings[item.item_id] = item.rating;
      if (item.notes) interviewNotes[item.item_id] = item.notes;
    } else if (item.method === "work_sample" && item.item_id === "response") {
      workSampleNotes = item.notes || "";
    } else if (item.method === "work_sample" && item.rating != null) {
      workSampleRatings[item.item_id] = item.rating;
    }
  }
  const submittedInvite = (row.assessment_invites || []).find((invite) => invite.submitted_at && invite.candidate_response);
  if (submittedInvite) workSampleNotes = submittedInvite.candidate_response;
  return {
    id: row.id,
    candidateId: row.candidate_id,
    name: row.candidates?.full_name || "Кандидат",
    email: row.candidates?.email || "",
    profileId: row.profile_key,
    status: row.status,
    createdAt: row.created_at,
    finalDecision: row.final_decision || "pending",
    decisionReason: row.decision_reason || "",
    interviewRatings, interviewNotes, workSampleRatings, workSampleNotes,
    outcomes: Object.fromEntries((row.outcome_followups || []).map((item) => [item.checkpoint_days, {
      retained: item.retained == null ? "" : String(item.retained),
      managerRating: item.manager_rating ?? "",
      kpiValue: item.kpi_value ?? "",
      kpiDefinition: item.kpi_definition || "",
      notes: item.notes || "",
    }])),
  };
}

export async function listAssessments(organizationId, currentUserId) {
  const { data, error } = await supabase.from("assessments")
    .select("id, candidate_id, profile_key, status, final_decision, decision_reason, created_at, candidates(full_name,email), assessment_evidence(rater_id,method,item_id,rating,notes), outcome_followups(checkpoint_days,retained,manager_rating,kpi_value,kpi_definition,notes), assessment_invites(candidate_response,submitted_at)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapRemoteAssessment(row, currentUserId));
}

export async function createAssessment(organizationId, userId, candidate) {
  const { data: person, error: personError } = await supabase.from("candidates").insert({
    organization_id: organizationId,
    full_name: candidate.name,
    email: candidate.email || null,
    consent_at: candidate.email ? new Date().toISOString() : null,
    created_by: userId,
  }).select("id").single();
  if (personError) throw personError;

  const { data: assessment, error: assessmentError } = await supabase.from("assessments").insert({
    organization_id: organizationId,
    candidate_id: person.id,
    profile_key: candidate.profileId,
    status: "assessment",
    created_by: userId,
  }).select("id, created_at").single();
  if (assessmentError) {
    await supabase.from("candidates").delete().eq("id", person.id);
    throw assessmentError;
  }
  return { ...candidate, id: assessment.id, candidateId: person.id, createdAt: assessment.created_at };
}

export async function saveAssessment(organizationId, userId, candidate) {
  const finalDecision = candidate.finalDecision && candidate.finalDecision !== "pending" ? candidate.finalDecision : null;
  const { error: assessmentError } = await supabase.from("assessments").update({
    final_decision: finalDecision,
    decision_reason: candidate.decisionReason || null,
    status: finalDecision ? "decision" : "assessment",
    updated_at: new Date().toISOString(),
  }).eq("id", candidate.id).eq("organization_id", organizationId);
  if (assessmentError) throw assessmentError;

  const evidence = [];
  const add = (method, itemId, rating, notes = null) => evidence.push({
    organization_id: organizationId,
    assessment_id: candidate.id,
    rater_id: userId,
    method,
    item_id: itemId,
    rating: rating ?? null,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  });
  const interviewIds = new Set([...Object.keys(candidate.interviewRatings), ...Object.keys(candidate.interviewNotes)]);
  interviewIds.forEach((id) => add("structured_interview", id, candidate.interviewRatings[id], candidate.interviewNotes[id]));
  Object.entries(candidate.workSampleRatings).forEach(([id, rating]) => add("work_sample", id, rating));
  if (candidate.workSampleNotes) add("work_sample", "response", null, candidate.workSampleNotes);
  if (evidence.length) {
    const { error } = await supabase.from("assessment_evidence").upsert(evidence, { onConflict: "assessment_id,rater_id,method,item_id" });
    if (error) throw error;
  }
}

export async function deleteAssessment(organizationId, candidate) {
  const { error } = await supabase.from("assessments").delete().eq("id", candidate.id).eq("organization_id", organizationId);
  if (error) throw error;
  if (candidate.candidateId) await supabase.from("candidates").delete().eq("id", candidate.candidateId).eq("organization_id", organizationId);
}

export async function saveOutcome(organizationId, userId, assessmentId, checkpointDays, outcome) {
  const payload = {
    organization_id: organizationId,
    assessment_id: assessmentId,
    checkpoint_days: checkpointDays,
    retained: outcome.retained === "" ? null : outcome.retained === "true",
    manager_rating: outcome.managerRating === "" ? null : Number(outcome.managerRating),
    kpi_value: outcome.kpiValue === "" ? null : Number(outcome.kpiValue),
    kpi_definition: outcome.kpiDefinition || null,
    notes: outcome.notes || null,
    recorded_by: userId,
    recorded_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("outcome_followups").upsert(payload, { onConflict: "assessment_id,checkpoint_days" });
  if (error) throw error;
}

export async function createCandidateInvite(assessmentId) {
  const { data, error } = await supabase.rpc("create_assessment_invite", { target_assessment: assessmentId });
  if (error) throw error;
  return `${window.location.origin}/candidate?token=${encodeURIComponent(data)}`;
}

export async function getCandidateAssignment(token) {
  const { data, error } = await supabase.rpc("get_candidate_assignment", { raw_token: token });
  if (error) throw error;
  return data?.[0] || null;
}

export async function submitCandidateAssignment(token, response, consent) {
  const { data, error } = await supabase.rpc("submit_candidate_assignment", { raw_token: token, response_text: response, consent_given: consent });
  if (error) throw error;
  if (!data) throw new Error("Ссылка истекла, ответ уже отправлен или текст слишком короткий.");
}
