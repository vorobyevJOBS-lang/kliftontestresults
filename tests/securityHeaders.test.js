import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("candidate capability links are protected by browser security headers", () => {
  const globalHeaders = config.headers.find((entry) => entry.source === "/(.*)")?.headers || [];
  const byName = Object.fromEntries(globalHeaders.map((header) => [header.key.toLowerCase(), header.value]));

  assert.equal(byName["referrer-policy"], "no-referrer");
  assert.equal(byName["x-content-type-options"], "nosniff");
  assert.equal(byName["x-frame-options"], "DENY");
  assert.match(byName["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(byName["content-security-policy"], /object-src 'none'/);

  for (const path of ["/candidate", "/hr", "/admin"]) {
    const cache = config.headers.find((entry) => entry.source === path)?.headers
      ?.find((header) => header.key.toLowerCase() === "cache-control")?.value;
    assert.equal(cache, "private, no-store");
  }
});
