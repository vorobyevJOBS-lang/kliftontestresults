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
