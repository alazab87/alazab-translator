const { Ratelimit } = require("@upstash/ratelimit");
const { Redis }     = require("@upstash/redis");

// One shared Redis client
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 30 translations per hour per IP (sliding window)
const translateLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(30, "1 h"),
  prefix:    "rl:translate",
  analytics: true,
});

// 10 image scans per hour per IP (vision is expensive)
const visionLimiter = new Ratelimit({
  redis,
  limiter:   Ratelimit.slidingWindow(10, "1 h"),
  prefix:    "rl:vision",
  analytics: true,
});

/**
 * Get the real client IP from a Vercel request.
 */
function getIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Check rate limit. Returns null if OK, or a 429 response body if exceeded.
 * Usage:
 *   const limited = await checkLimit(translateLimiter, req);
 *   if (limited) return res.status(429).json(limited);
 */
async function checkLimit(limiter, req) {
  try {
    const ip = getIp(req);
    const { success, limit, remaining, reset } = await limiter.limit(ip);
    if (!success) {
      const retryMins = Math.ceil((reset - Date.now()) / 60000);
      return {
        error: `Rate limit reached. You can make ${limit} requests per hour. Please try again in ${retryMins} minute${retryMins !== 1 ? "s" : ""}.`,
        retryAfter: retryMins,
      };
    }
    return null; // all good
  } catch (e) {
    // If Redis is down, fail open — don't block users
    console.error("Rate limit check failed:", e.message);
    return null;
  }
}

module.exports = { checkLimit, translateLimiter, visionLimiter };
