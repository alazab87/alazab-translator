const { supabase } = require("./_supabase");

// Simple in-memory JWT cache — avoids a Supabase round-trip on every request.
// Cache entries expire after 5 minutes (tokens are valid for 1 hour).
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const tokenCache = new Map(); // token → { user, expiresAt }

function getCached(token) {
  const entry = tokenCache.get(token);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { tokenCache.delete(token); return undefined; }
  return entry.user;
}

function setCached(token, user) {
  // Evict old entries if cache grows large (keep max 500 entries)
  if (tokenCache.size >= 500) {
    const oldest = tokenCache.keys().next().value;
    tokenCache.delete(oldest);
  }
  tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

/**
 * Extract and verify the Supabase JWT from the request.
 * Returns the user object if valid, or null for anonymous requests.
 * Results are cached for 5 minutes to avoid repeated Supabase round-trips.
 */
async function getUserFromRequest(req) {
  try {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    // Return cached result if available
    const cached = getCached(token);
    if (cached !== undefined) return cached;

    if (!supabase) return null; // Supabase not configured — treat as anonymous
    const { data: { user }, error } = await supabase.auth.getUser(token);
    const result = (error || !user) ? null : user;

    setCached(token, result);
    return result;
  } catch {
    return null; // fail open — don't break translation if auth is down
  }
}

module.exports = { getUserFromRequest };
