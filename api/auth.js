export default function handler(_req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(410).json({
    data: null,
    error: { message: "Старый вход отключён. Используйте защищённый кабинет /hr." },
  });
}
