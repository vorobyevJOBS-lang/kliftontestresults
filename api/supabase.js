export default function handler(_req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(410).json({
    data: null,
    error: { message: "Старые тесты выведены из активного найма. Используйте персональную ссылку EvidenceHire." },
  });
}
