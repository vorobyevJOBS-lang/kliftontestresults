import crypto from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_ANON_KEY || "klifton-session-secret";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function createSessionToken(payload) {
  const body = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encodedPayload = base64url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  if (!signature || signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
