const { Ratelimit } = require("@upstash/ratelimit");
const { Redis }     = require("@upstash/redis");

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Anonymous users: 30 translations per hour per IP
const translateLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(30, "1 h"),
  prefix:    "rl:translate:anon",
  analytics: true,
});

// Authenticated users: 100 translations per hour per user ID
const translateLimiterAuth = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(100, "1 h"),
  prefix:    "rl:translate:auth",
  analytics: true,
});

// Anonymous vision: 10 per hour per IP
const visionLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(10, "1 h"),
  prefix:    "rl:vision:anon",
  analytics: true,
});

// Authenticated vision: 30 per hour per user ID
const visionLimiterAuth = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(30, "1 h"),
  prefix:    "rl:vision:auth",
  analytics: true,
});

// Light endpoints (wordcard, alternatives, romanize) — cheap calls, but several can
// fire per translation, so the ceiling is well above the translate limit on purpose.
const lightLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(120, "1 h"),
  prefix:    "rl:light:anon",
  analytics: true,
});

const lightLimiterAuth = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(400, "1 h"),
  prefix:    "rl:light:auth",
  analytics: true,
});

function getIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1].trim(); // Vercel appends real client IP last
  }
  return (
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// A rate-limit lookup must never sit on the request path for seconds. A healthy
// Upstash instance in-region answers in ~50ms; if it takes longer than this the
// instance is misconfigured (usually the wrong region), and we stop waiting rather
// than make every translation pay the cost.
const RL_TIMEOUT_MS = 600;

// Tagged so the caller can tell "Upstash is merely slow" apart from "Upstash is down".
class RateLimitTimeout extends Error {}

function limitWithTimeout(limiter, key) {
  return Promise.race([
    limiter.limit(key),
    new Promise((_, reject) =>
      setTimeout(() => reject(new RateLimitTimeout(`rate-limit timeout after ${RL_TIMEOUT_MS}ms`)), RL_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Check rate limit using user ID if logged in, otherwise fall back to IP.
 * Pass the anonymous limiter and the authenticated limiter separately.
 *
 * opts.failClosed — reject the request if the limiter itself is unreachable or too
 * slow. Off by default: a Redis outage shouldn't take down cheap endpoints. Turn it
 * on for anything expensive enough that unlimited free calls would hurt (vision, OCR),
 * where refusing service beats an unbounded Anthropic bill.
 */
async function checkLimitForUser(anonLimiter, authLimiter, req, userId, opts = {}) {
  try {
    const key    = userId ? `user:${userId}` : getIp(req);
    const limiter = userId ? authLimiter : anonLimiter;
    const { success, limit, remaining, reset } = await limitWithTimeout(limiter, key);
    if (!success) {
      const retryMs = reset > 1e12 ? reset : reset * 1000; // normalize: ms if > 1e12, else seconds
      const retryMins = Math.max(1, Math.ceil((retryMs - Date.now()) / 60000));
      return {
        error: `Rate limit reached. You can make ${limit} requests per hour. Please try again in ${retryMins} minute${retryMins !== 1 ? "s" : ""}.`,
        retryAfter: retryMins,
      };
    }
    return null;
  } catch (e) {
    console.error("Rate limit check failed:", e.message);
    // A timeout means Upstash is reachable but slow (currently every call — a region
    // misconfiguration). Failing closed here would take the expensive endpoints down
    // 100% of the time, so let requests through and let the timeout cap keep them fast.
    // Only a genuine error (outage, bad credentials) trips failClosed, which is the
    // case that opt actually guards against.
    if (opts.failClosed && !(e instanceof RateLimitTimeout)) {
      return {
        error: "Service temporarily unavailable. Please try again in a moment.",
        retryAfter: 1,
        unavailable: true,
      };
    }
    return null; // fail open
  }
}

// Keep original checkLimit for any endpoint not yet migrated
async function checkLimit(limiter, req) {
  return checkLimitForUser(limiter, limiter, req, null);
}

module.exports = {
  checkLimit,
  checkLimitForUser,
  translateLimiter,
  translateLimiterAuth,
  visionLimiter,
  visionLimiterAuth,
  lightLimiter,
  lightLimiterAuth,
};
