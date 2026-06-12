// Access gate for the election-maps demo.
//
// The secret (APP_CODE) lives only on the server — `.dev.vars` locally, a Wrangler
// secret in production. The client never sees it. On a correct code we set a 30-day
// HttpOnly cookie holding an HMAC token (not the raw code), and gate the data files
// behind it. The app SHELL (HTML/JS/CSS) stays public so the login UI can load;
// only /data/* (the actual content) requires auth. If APP_CODE is unset, the gate is
// disabled and everything is public — so the app runs out-of-the-box without a secret.

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  APP_CODE?: string;
}

const COOKIE = "app_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const enc = new TextEncoder();

/** Deterministic HMAC token derived from the secret — safe to store in the cookie. */
async function token(code: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(code), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("election-maps-auth-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

const cookieAttrs = `Path=/; HttpOnly; Secure; SameSite=Strict`;

async function isAuthed(request: Request, env: Env): Promise<boolean> {
  if (!env.APP_CODE) return true; // gate disabled
  const c = getCookie(request, COOKIE);
  return !!c && safeEqual(c, await token(env.APP_CODE));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/login" && request.method === "POST") {
      if (!env.APP_CODE) return json({ ok: true });
      const body = (await request.json().catch(() => ({}))) as { code?: string };
      if (typeof body.code === "string" && safeEqual(body.code, env.APP_CODE)) {
        const t = await token(env.APP_CODE);
        return json({ ok: true }, { headers: { "Set-Cookie": `${COOKIE}=${t}; Max-Age=${MAX_AGE}; ${cookieAttrs}` } });
      }
      return json({ ok: false }, { status: 401 });
    }

    if (url.pathname === "/api/logout" && request.method === "POST") {
      return json({ ok: true }, { headers: { "Set-Cookie": `${COOKIE}=; Max-Age=0; ${cookieAttrs}` } });
    }

    // Gate the data; the app shell stays public so the login screen can render.
    if (url.pathname.startsWith("/data/") && !(await isAuthed(request, env))) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    return env.ASSETS.fetch(request);
  },
};
