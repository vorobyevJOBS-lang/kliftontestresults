export const INVITE_STATUS = {
  none: { label: "Ссылка не создана", tone: "neutral" },
  created: { label: "Ссылка создана", tone: "neutral" },
  opened: { label: "Кандидат открыл", tone: "progress" },
  in_progress: { label: "Кандидат заполняет", tone: "progress" },
  submitted: { label: "Ответ получен", tone: "success" },
  expired: { label: "Срок ссылки истёк", tone: "warning" },
};

const timestamp = (value) => {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

export function deriveInviteProgress(invites = [], now = Date.now()) {
  const ordered = [...invites].sort((first, second) => timestamp(second.created_at) - timestamp(first.created_at));
  const submitted = ordered.find((invite) => invite.submitted_at);
  const latest = ordered[0];
  if (submitted) {
    return {
      status: "submitted",
      hasInvite: true,
      createdAt: submitted.created_at || "",
      openedAt: submitted.opened_at || "",
      draftUpdatedAt: submitted.draft_updated_at || "",
      submittedAt: submitted.submitted_at,
      expiresAt: submitted.expires_at || "",
    };
  }
  if (!latest) return { status: "none", hasInvite: false, createdAt: "", openedAt: "", draftUpdatedAt: "", submittedAt: "", expiresAt: "" };

  const expired = Boolean(latest.revoked_at) || (timestamp(latest.expires_at) > 0 && timestamp(latest.expires_at) <= timestamp(now));
  const status = expired ? "expired" : latest.draft_updated_at ? "in_progress" : latest.opened_at ? "opened" : "created";
  return {
    status,
    hasInvite: true,
    createdAt: latest.created_at || "",
    openedAt: latest.opened_at || "",
    draftUpdatedAt: latest.draft_updated_at || "",
    submittedAt: "",
    expiresAt: latest.expires_at || "",
  };
}

