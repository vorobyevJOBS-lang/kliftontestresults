export function refreshCanApply(startEditVersion, currentEditVersion) {
  return startEditVersion === currentEditVersion;
}

export async function saveCardThenOutcomes({ saveCard, saveCheckpoint, outcomeDays, onCardSaved }) {
  const saved = await saveCard();
  onCardSaved(saved);
  for (const days of outcomeDays) await saveCheckpoint(days);
  return saved;
}
