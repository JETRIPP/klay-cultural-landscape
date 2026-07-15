import crypto from "node:crypto";

export const AUTH_COOKIE_NAME = "klay_auth";

// The cookie stores a derived token, never the plaintext passphrase itself -
// so inspecting the cookie value doesn't reveal the shared passphrase.
export function computeAuthToken(): string {
  const passphrase = process.env.SITE_PASSPHRASE ?? "";
  const secret = process.env.SITE_SESSION_SECRET ?? "";
  return crypto.createHash("sha256").update(`${passphrase}:${secret}`).digest("hex");
}

export function checkPassphrase(candidate: string): boolean {
  const expected = process.env.SITE_PASSPHRASE ?? "";
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
