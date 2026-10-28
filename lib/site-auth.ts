export const SITE_AUTH_COOKIE = "bgp_gate";

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sitePassword(): string {
  return (process.env.SITE_PASSWORD || "").trim();
}

export async function gateToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`bgp-gate:${password}`));
  return toHex(digest);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function cookieMatches(cookie: string | undefined, password: string): Promise<boolean> {
  if (!cookie || !password) return false;
  return safeEqual(cookie, await gateToken(password));
}
