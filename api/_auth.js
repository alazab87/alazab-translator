const { supabase } = require("./_supabase");

/**
 * Extract and verify the Supabase JWT from the request.
 * Returns the user object if valid, or null for anonymous requests.
 */
async function getUserFromRequest(req) {
  try {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return null;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user; // { id, email, ... }
  } catch {
    return null;
  }
}

module.exports = { getUserFromRequest };
