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

/**
 * Check rate limit using user ID if logged in, otherwise fall back to IP.
 * Pass the anonymous limiter and the authenticated limiter separately.
 *
 * opts.failClosed — reject the request if the limiter itself is unreachable.
 * Off by default: a Redis outage shouldn't take down cheap endpoints. Turn it on
 * for anything expensive enough that unlimited free calls would hurt (vision, OCR),
 * where refusing service beats an unbounded Anthropic bill.
 */
async function checkLimitForUser(anonLimiter, authLimiter, req, userId, opts = {}) {
  try {
    const key    = userId ? `user:${userId}` : getIp(req);
    const limiter = userId ? authLimiter : anonLimiter;
    const { success, limit, remaining, reset } = await limiter.limit(key);
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
    if (opts.failClosed) {
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
