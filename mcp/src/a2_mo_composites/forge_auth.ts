/** Tier a2 — stateful API key validator with in-process cache. */

const AUTH_ENDPOINT = "https://forge-auth.atomadic.tech/v1/forge/auth/verify";
const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes — same as Python forge

const VALID_KEY_PREFIXES = ["fk_live_", "fk_dlx_", "ak_master_"];

function isValidKeyShape(key: string): boolean {
  return VALID_KEY_PREFIXES.some((pfx) => key.startsWith(pfx) && key.length > pfx.length);
}

interface CacheEntry { valid: boolean; ts: number }

const _cache = new Map<string, CacheEntry>();

/** Returns true if the key is valid and active. Caches results for 5 min.
 *  Accepts fk_live_* (standard), fk_dlx_* (deluxe), ak_master_* (master suite). */
export async function validateApiKey(key: string): Promise<boolean> {
  if (!key || !isValidKeyShape(key)) return false;

  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.valid;

  let valid = false;
  try {
    const res = await fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "atomadic-forge-mcp/0.10.0",
      },
      body: JSON.stringify({ api_key: key }),
    });
    if (res.ok) {
      const body = await res.json() as { ok?: boolean };
      valid = body.ok === true;
    } else {
      valid = false;
    }
  } catch {
    // Network error — fail open so a transient outage doesn't lock everyone out
    valid = true;
  }

  _cache.set(key, { valid, ts: Date.now() });
  // Evict old entries to keep memory bounded
  if (_cache.size > 1000) {
    const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _cache.delete(oldest[0]);
  }

  return valid;
}

/** Extract the API key from an MCP HTTP request. Checks X-API-Key and Authorization: Bearer. */
export function extractKey(request: Request): string | null {
  const xkey = request.headers.get("X-API-Key");
  if (xkey) return xkey;
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

/** Tools that are free — no key required. */
export const FREE_TOOLS = new Set([
  "recipes",
  "score_patch",
  "preflight_change",
  "trust_gate_response",
  "doctor",
]);
