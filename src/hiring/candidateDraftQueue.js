export function createSerialDraftQueue(saveDraft, initialPayload = "") {
  let tail = Promise.resolve();
  let lastSaved = initialPayload;
  let uncertain = false;

  return {
    initialize(payload) {
      lastSaved = payload || "";
      uncertain = false;
    },
    enqueue(payload) {
      const task = tail.catch(() => {}).then(async () => {
        if (uncertain || payload !== lastSaved) {
          try {
            await saveDraft(payload);
          } catch (error) {
            uncertain = true;
            throw error;
          }
        }
        lastSaved = payload;
        uncertain = false;
        return payload;
      });
      tail = task;
      return task;
    },
    waitForIdle() {
      return tail;
    },
    lastSaved() {
      return lastSaved;
    },
  };
}

export function hasCurrentConsent(assignment, noticeVersion) {
  if (assignment?.submitted_at) return true;
  if (!assignment?.consent_at) return false;
  const notice = typeof assignment.consent_notice === "string"
    ? (() => { try { return JSON.parse(assignment.consent_notice); } catch { return null; } })()
    : assignment.consent_notice;
  return notice?.version === noticeVersion;
}

// Browser-side safety copy of answers the server has not confirmed yet. It is
// keyed by a hash of the invitation token and removed after a confirmed save.
export const LOCAL_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export async function localDraftKey(token) {
  const bytes = new TextEncoder().encode(`evidencehire-draft:${token}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `evidencehire-draft:${hex.slice(0, 32)}`;
}

export function readLocalDraft(storage, key) {
  try {
    const entry = JSON.parse(storage?.getItem(key) || "null");
    return entry && typeof entry.payload === "string" ? entry : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(storage, key, payload, baseline, now = Date.now()) {
  try {
    storage?.setItem(key, JSON.stringify({ payload, baseline, savedAt: now }));
  } catch {
    // Storage may be full or disabled; the server draft remains the source.
  }
}

export function clearLocalDraft(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

// Restore a local copy only when it was written on top of the exact server
// version we see now; otherwise a newer server draft (another device) wins.
export function chooseLocalDraft(localEntry, serverPayload, submitted, now = Date.now()) {
  if (!localEntry || submitted) return null;
  if (typeof localEntry.savedAt !== "number" || now - localEntry.savedAt > LOCAL_DRAFT_MAX_AGE_MS) return null;
  if (localEntry.payload === (serverPayload || "")) return null;
  if ((localEntry.baseline || "") !== (serverPayload || "")) return null;
  return localEntry.payload;
}
