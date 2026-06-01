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

function getIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Check rate limit using user ID if logged in, otherwise fall back to IP.
 * Pass the anonymous limiter and the authenticated limiter separately.
 */
async function checkLimitForUser(anonLimiter, authLimiter, req, userId) {
  try {
    const key    = userId ? `user:${userId}` : getIp(req);
    const limiter = userId ? authLimiter : anonLimiter;
    const { success, limit, remaining, reset } = await limiter.limit(key);
    if (!success) {
      const retryMins = Math.ceil((reset - Date.now()) / 60000);
      return {
        error: `Rate limit reached. You can make ${limit} requests per hour. Please try again in ${retryMins} minute${retryMins !== 1 ? "s" : ""}.`,
        retryAfter: retryMins,
      };
    }
    return null;
  } catch (e) {
    console.error("Rate limit check failed:", e.message);
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
};
