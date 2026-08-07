import { candidateSupabase, supabase } from "../evidenceSupabase";
import { parseCandidateResponse } from "./candidateResponse.js";
import { toDateTimeLocal } from "./dateTime.js";

export { parseCandidateResponse };

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
    .select("organization_id, role, branch_id, organizations(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: grants, error: grantsError } = await supabase.from("organization_member_branches")
    .select("branch_id")
    .eq("organization_id", data.organization_id)
    .eq("user_id", userId);
  if (grantsError) throw grantsError;
  return {
    ...data,
    branch_ids: [...new Set([
      ...(data.branch_id ? [data.branch_id] : []),
      ...(grants || []).map((item) => item.branch_id),
    ])],
  };
}

export async function listLegacyResults() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Нет активной сессии");
  const response = await fetch("/api/evidence-legacy", { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Не удалось загрузить архив прежних тестов");
  return payload;
}

export async function getLegacyResultDetail(table, id) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Нет активной сессии");
  const params = new URLSearchParams({ table, id: String(id) });
  const response = await fetch(`/api/evidence-legacy?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Не удалось загрузить прежний результат");
  return payload.item;
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

export async function promoteProfileToPilot(organizationId, userId, profile, review) {
  const nextVersion = (profile.version || 1) + 1;
  const reviewedProfile = {
    ...profile,
    version: nextVersion,
    status: "pilot",
    scoringPlan: null,
    jobAnalysis: {
      status: "owner_confirmed",
      reviewedAt: new Date().toISOString(),
      reviewedBy: userId,
      reviewers: review.reviewers.trim(),
      criticalTasks: review.criticalTasks.trim(),
      criticalErrors: review.criticalErrors.trim(),
      entryRequirements: review.entryRequirements.trim(),
      outcomeDefinition: review.outcomeDefinition.trim(),
      representativeSampleConfirmed: true,
      anchorsConfirmed: true,
      accommodationsConfirmed: true,
    },
  };
  const { error } = await supabase.from("job_profiles").insert({
    organization_id: organizationId,
    slug: reviewedProfile.id,
    name: reviewedProfile.name,
    family: reviewedProfile.family,
    version: reviewedProfile.version,
    status: reviewedProfile.status,
    definition: reviewedProfile,
    created_by: userId,
  });
  if (error) throw error;
  return reviewedProfile;
}

function mapRemoteAssessment(row, currentUserId) {
  const interviewRatings = {}, interviewNotes = {}, workSampleRatings = {};
  let workSampleNotes = "";
  let observedConfirmed = false;
  let referenceNotes = "";
  const allEvidence = row.assessment_evidence || [];
  for (const item of allEvidence.filter((entry) => entry.rater_id === currentUserId)) {
    if (item.method === "structured_interview") {
      if (item.rating != null) interviewRatings[item.item_id] = item.rating;
      if (item.notes) interviewNotes[item.item_id] = item.notes;
    } else if (item.method === "work_sample" && ["response", "reviewer_notes"].includes(item.item_id)) {
      workSampleNotes = item.notes || "";
    } else if (item.method === "work_sample" && item.item_id === "observer_attestation") {
      observedConfirmed = item.notes === "confirmed";
    } else if (item.method === "work_sample" && item.rating != null) {
      workSampleRatings[item.item_id] = item.rating;
    }
  }
  const legacyReference = [...allEvidence]
    .filter((item) => ["reference", "structured_reference"].includes(item.method) && item.item_id === "summary")
    .sort((first, second) => new Date(second.updated_at || 0) - new Date(first.updated_at || 0))[0];
  const canonicalReference = Array.isArray(row.assessment_reference_checks)
    ? row.assessment_reference_checks[0]
    : row.assessment_reference_checks;
  referenceNotes = canonicalReference?.payload ?? legacyReference?.notes ?? "";
  const invites = row.assessment_invites || [];
  const submittedInvite = [...invites]
    .filter((invite) => invite.submitted_at && invite.candidate_response)
    .sort((first, second) => new Date(second.submitted_at) - new Date(first.submitted_at))[0];
  const candidateResponse = parseCandidateResponse(submittedInvite?.candidate_response);
  const raterEvidence = Object.values(allEvidence.filter((item) => item.submitted_at).reduce((groups, item) => {
    groups[item.rater_id] ||= {
      raterId: item.rater_id,
      submittedAt: item.submitted_at,
      ratings: {},
      notes: {},
    };
    if (item.rating != null) groups[item.rater_id].ratings[`${item.method}:${item.item_id}`] = item.rating;
    if (item.notes) groups[item.rater_id].notes[`${item.method}:${item.item_id}`] = item.notes;
    return groups;
  }, {}));
  const currentRaterSubmittedAt = allEvidence.find((item) => item.rater_id === currentUserId && item.submitted_at)?.submitted_at || "";
  return {
    id: row.id,
    candidateId: row.candidate_id,
    name: row.candidates?.full_name || "Кандидат",
    email: row.candidates?.email || "",
    branchId: row.branch_id || row.candidates?.branch_id || "",
    candidateModules: row.candidate_modules || [],
    profileId: row.profile_key,
    profileDefinition: row.profile_definition || null,
    status: row.status,
    pipelineStage: row.pipeline_stage || "new",
    nextAction: row.next_action || "",
    nextActionAt: toDateTimeLocal(row.next_action_at),
    rejectionReason: row.rejection_reason || "",
    source: row.source || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    profileVersion: row.profile_version || 1,
    archivedAt: row.archived_at || "",
    archiveReason: row.archive_reason || "",
    finalDecision: row.final_decision || "pending",
    decisionReason: row.decision_reason || "",
    notes: (row.candidate_notes || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    interviewRatings, interviewNotes, workSampleRatings, workSampleNotes, observedConfirmed,
    candidateWorkSample: candidateResponse.workSample,
    workPreferenceAnswers: candidateResponse.workPreferenceAnswers,
    referenceNotes,
    referenceOriginalNotes: referenceNotes,
    screeningResponses: candidateResponse.screening,
    candidateSubmittedAt: submittedInvite?.submitted_at || "",
    hasInvite: invites.length > 0,
    currentRaterSubmittedAt,
    raterEvidence,
    outcomes: Object.fromEntries((row.outcome_followups || []).map((item) => [item.checkpoint_days, {
      retained: item.retained == null ? "" : String(item.retained),
      managerRating: item.manager_rating ?? "",
      kpiValue: item.kpi_value ?? "",
      kpiDefinition: item.kpi_definition || "",
      kpiDefinitionLocked: Boolean(item.kpi_definition),
      notes: item.notes || "",
    }])),
  };
}

export async function listAssessments(organizationId, currentUserId) {
  const base = "id, candidate_id, profile_key, profile_version, profile_definition, candidate_modules, branch_id, status, pipeline_stage, next_action, next_action_at, rejection_reason, source, final_decision, decision_reason, created_at, updated_at, archived_at, archive_reason, candidates(full_name,email,branch_id,archived_at), outcome_followups(checkpoint_days,retained,manager_rating,kpi_value,kpi_definition,notes), assessment_reference_checks(payload,updated_at), assessment_invites(id,opened_at,candidate_response,submitted_at), candidate_notes(id,body,created_at,author_id), assessment_evidence(rater_id,method,item_id,rating,notes,updated_at,submitted_at)";
  const legacyBase = "id, candidate_id, profile_key, branch_id, status, pipeline_stage, next_action, next_action_at, rejection_reason, source, final_decision, decision_reason, created_at, updated_at, candidates(full_name,email,branch_id), outcome_followups(checkpoint_days,retained,manager_rating,kpi_value,kpi_definition,notes), assessment_invites(candidate_response,submitted_at), candidate_notes(id,body,created_at,author_id), assessment_evidence(rater_id,method,item_id,rating,notes,updated_at)";
  const query = (fields) => supabase.from("assessments")
    .select(fields)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  let { data, error } = await query(base);
  // The first production deploy intentionally precedes the additive migration.
  // During that short window, keep read-only CRM access available without
  // pretending that independent ratings have already been submitted.
  if (error && /profile_definition|profile_version|assessment_reference_checks|submitted_at|archived_at/i.test(error.message || "")) {
    ({ data, error } = await query(legacyBase));
  }
  if (error) throw error;
  return (data || []).map((row) => mapRemoteAssessment(row, currentUserId));
}

export async function createAssessment(organizationId, userId, candidate, profileDefinition) {
  if (!userId) throw new Error("Нет авторизованного пользователя");
  const { data, error } = await supabase.rpc("create_candidate_assessment", {
    target_organization: organizationId,
    candidate_name: candidate.name.trim(),
    candidate_email: candidate.email?.trim() || null,
    target_branch: candidate.branchId || null,
    target_profile_key: candidate.profileId,
    target_profile_version: candidate.profileVersion || 1,
    target_profile_definition: profileDefinition,
    candidate_source: candidate.source || null,
    target_candidate_modules: candidate.candidateModules || [],
  });
  if (error) throw error;
  const created = typeof data === "string" ? JSON.parse(data) : data;
  if (!created?.assessment_id || !created?.candidate_id) throw new Error("База не вернула созданную оценку");
  return {
    ...candidate,
    profileDefinition,
    id: created.assessment_id,
    candidateId: created.candidate_id,
    createdAt: created.created_at || new Date().toISOString(),
    updatedAt: created.updated_at || created.created_at || new Date().toISOString(),
  };
}

export async function setAssessmentCandidateModules(assessmentId, modules) {
  const { data, error } = await supabase.rpc("set_assessment_candidate_modules", {
    target_assessment: assessmentId,
    target_modules: modules,
  });
  if (error) throw error;
  return data || [];
}

export async function saveAssessment(organizationId, userId, candidate, { manageAssessment = true } = {}) {
  let updatedAt = candidate.updatedAt || null;
  const finalDecision = candidate.finalDecision && candidate.finalDecision !== "pending" ? candidate.finalDecision : null;
  const referenceChanged = candidate.referenceNotes !== (candidate.referenceOriginalNotes ?? "");
  if (manageAssessment && finalDecision && (candidate.decisionReason || "").trim().length < 10) {
    throw new Error("Для решения нужно обоснование по рабочим критериям не короче 10 символов.");
  }

  // Independent draft evidence is scoped to the current rater. Save it before
  // the optimistic card transaction so a later evidence error cannot leave the
  // browser holding an obsolete assessment timestamp.
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
  if (!candidate.currentRaterSubmittedAt) {
    const interviewIds = new Set([...Object.keys(candidate.interviewRatings), ...Object.keys(candidate.interviewNotes)]);
    interviewIds.forEach((id) => add("structured_interview", id, candidate.interviewRatings[id], candidate.interviewNotes[id]));
    Object.entries(candidate.workSampleRatings).forEach(([id, rating]) => add("work_sample", id, rating));
    add("work_sample", "reviewer_notes", null, candidate.workSampleNotes || null);
    add("work_sample", "observer_attestation", null, candidate.observedConfirmed ? "confirmed" : null);
  }
  if (evidence.length) {
    const { error } = await supabase.from("assessment_evidence").upsert(evidence, { onConflict: "assessment_id,rater_id,method,item_id" });
    if (error) throw error;
  }

  const saveLegacyReference = async () => {
    if (!referenceChanged) return;
    const { error } = await supabase.from("assessment_evidence").upsert({
      organization_id: organizationId,
      assessment_id: candidate.id,
      rater_id: userId,
      method: "reference",
      item_id: "summary",
      rating: null,
      notes: candidate.referenceNotes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "assessment_id,rater_id,method,item_id" });
    if (error) throw error;
  };

  if (manageAssessment) {
    const rpcPayload = {
      target_assessment: candidate.id,
      expected_updated_at: candidate.updatedAt,
      target_final_decision: finalDecision,
      target_decision_reason: candidate.decisionReason || null,
      target_pipeline_stage: candidate.pipelineStage || "new",
      target_next_action: candidate.nextAction || null,
      target_next_action_at: candidate.nextActionAt ? new Date(candidate.nextActionAt).toISOString() : null,
      target_rejection_reason: candidate.rejectionReason || null,
      target_source: candidate.source || null,
      reference_changed: referenceChanged,
      target_reference_check: candidate.referenceNotes || "",
    };
    let { data: rpcUpdatedAt, error: rpcError } = await supabase.rpc("save_assessment_card", rpcPayload);
    const missingRpc = rpcError && (rpcError.code === "PGRST202" || /save_assessment_card|function .* does not exist/i.test(rpcError.message || ""));
    if (missingRpc) {
      // Compatibility window only: old production stores the reference in the
      // evidence table. Do this before the timestamped card update so nothing
      // fallible runs after a successful optimistic write.
      await saveLegacyReference();
      let assessmentUpdate = supabase.from("assessments").update({
        final_decision: finalDecision,
        decision_reason: candidate.decisionReason || null,
        status: finalDecision ? "decision" : "assessment",
        pipeline_stage: candidate.pipelineStage || "new",
        next_action: candidate.nextAction || null,
        next_action_at: candidate.nextActionAt ? new Date(candidate.nextActionAt).toISOString() : null,
        rejection_reason: candidate.rejectionReason || null,
        source: candidate.source || null,
        updated_at: new Date().toISOString(),
      }).eq("id", candidate.id).eq("organization_id", organizationId);
      if (candidate.updatedAt) assessmentUpdate = assessmentUpdate.eq("updated_at", candidate.updatedAt);
      const { data: updatedAssessment, error: assessmentError } = await assessmentUpdate.select("updated_at").maybeSingle();
      if (assessmentError) throw assessmentError;
      if (!updatedAssessment) throw new Error("Карточку изменил другой участник. Обновите данные перед повторным сохранением.");
      rpcUpdatedAt = updatedAssessment.updated_at;
      rpcError = null;
    }
    if (rpcError) {
      if (rpcError.code === "40001") throw new Error("Карточку изменил другой участник. Обновите данные и сравните изменения перед повторным сохранением.");
      throw rpcError;
    }
    updatedAt = rpcUpdatedAt;
  } else {
    await saveLegacyReference();
  }
  return { updatedAt, referenceOriginalNotes: candidate.referenceNotes || "" };
}

export async function addCandidateNote(organizationId, userId, assessmentId, body) {
  const { data, error } = await supabase.from("candidate_notes").insert({
    organization_id: organizationId, assessment_id: assessmentId, author_id: userId, body: body.trim(),
  }).select("id,body,created_at,author_id").single();
  if (error) throw error;
  return data;
}

export async function archiveAssessment(assessmentId, reason = "Закрыто командой найма") {
  const { data, error } = await supabase.rpc("archive_assessment", {
    target_assessment: assessmentId,
    reason_text: reason.trim(),
  });
  if (error) throw error;
  if (!data) throw new Error("Оценка не архивирована");
}

export async function restoreAssessment(assessmentId) {
  const { data, error } = await supabase.rpc("restore_assessment", { target_assessment: assessmentId });
  if (error) throw error;
  if (!data) throw new Error("Оценка не восстановлена");
}

export async function saveOutcome(organizationId, userId, assessmentId, checkpointDays, outcome) {
  if (outcome.managerRating !== "" && ![1, 3, 5].includes(Number(outcome.managerRating))) {
    throw new Error("Оценка руководителя должна использовать якорь 1, 3 или 5.");
  }
  if (outcome.kpiValue !== "" && ((outcome.kpiDefinition || "").trim().length < 20 || (outcome.notes || "").trim().length < 20)) {
    throw new Error("Для KPI укажите формулу/источник и рабочий контекст не короче 20 символов.");
  }
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

export async function submitAssessmentEvidence(assessmentId) {
  const { data, error } = await supabase.rpc("submit_assessment_evidence", { target_assessment: assessmentId });
  if (error) throw error;
  if (!data) throw new Error("Не удалось завершить независимую оценку.");
  return data;
}

export async function getCandidateAssignment(token) {
  const { data, error } = await candidateSupabase.rpc("get_candidate_assignment", { raw_token: token });
  if (error) throw error;
  return data?.[0] || null;
}

export async function submitCandidateAssignment(token, response, consent, noticeVersion) {
  const { data, error } = await candidateSupabase.rpc("submit_candidate_assignment", { raw_token: token, response_text: response, consent_given: consent, notice_version: noticeVersion });
  if (error) throw error;
  if (!data) throw new Error("Ссылка истекла, ответ уже отправлен или текст слишком короткий.");
}

export async function saveCandidateAssignmentDraft(token, response, consent, noticeVersion) {
  const { data, error } = await candidateSupabase.rpc("save_candidate_assignment_draft", { raw_token: token, response_text: response, consent_given: consent, notice_version: noticeVersion });
  if (error) throw error;
  if (!data) throw new Error("Черновик не сохранён: ссылка истекла или ответ уже отправлен.");
}
