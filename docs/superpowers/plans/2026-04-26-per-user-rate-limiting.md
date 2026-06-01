# Per-User Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anonymous IP-based rate limiting with user-ID-based limiting for logged-in users, giving authenticated users a higher quota (100 req/hr) while keeping the anonymous limit (30 req/hr) for guests.

**Architecture:** `_ratelimit.js` is extended with a `checkLimitForUser(limiter, req, userId)` function. If `userId` is present (logged-in), it uses the user ID as the Redis key. If null (anonymous), it falls back to IP. Two separate Ratelimit instances are created — one for anonymous (30/hr), one for authenticated (100/hr).

**Tech Stack:** `@upstash/ratelimit`, `@upstash/redis`, Supabase user IDs as Redis keys

**Prerequisite:** Login system plan must be fully deployed first.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `api/_ratelimit.js` | MODIFY | Add user-aware limiters and `checkLimitForUser` |
| `api/translate.js` | MODIFY | Call `checkLimitForUser` instead of `checkLimit` |
| `api/ocr-regions.js` | MODIFY | Same |
| `api/learn.js` | MODIFY | Same |

---

## Task 1: Extend `_ratelimit.js` with user-aware limiting

**Files:**
- Modify: `api/_ratelimit.js`

- [ ] **Step 1: Replace the contents of `api/_ratelimit.js` with this**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add api/_ratelimit.js
git commit -m "feat: add user-aware rate limiting — 100/hr for auth, 30/hr for anonymous"
git push
```

---

## Task 2: Update `api/translate.js` to use user-aware limiting

**Files:**
- Modify: `api/translate.js`

- [ ] **Step 1: Update the imports at the top of `translate.js`**

```javascript
// Replace:
const { checkLimit, translateLimiter } = require("./_ratelimit");
// With:
const { checkLimitForUser, translateLimiter, translateLimiterAuth } = require("./_ratelimit");
const { getUserFromRequest } = require("./_auth");
```

- [ ] **Step 2: Replace the rate limit check inside the handler**

```javascript
// Replace:
const limited = await checkLimit(translateLimiter, req);
if (limited) return res.status(429).json(limited);
// With:
const user    = await getUserFromRequest(req);
const userId  = user?.id || null;
const limited = await checkLimitForUser(translateLimiter, translateLimiterAuth, req, userId);
if (limited) return res.status(429).json(limited);
```

- [ ] **Step 3: Commit**

```bash
git add api/translate.js
git commit -m "feat: translate endpoint uses user-aware rate limiting"
git push
```

---

## Task 3: Update `api/ocr-regions.js` and `api/learn.js`

**Files:**
- Modify: `api/ocr-regions.js`
- Modify: `api/learn.js`

- [ ] **Step 1: Update `api/ocr-regions.js` imports**

```javascript
// Replace:
const { checkLimit, visionLimiter } = require("./_ratelimit");
// With:
const { checkLimitForUser, visionLimiter, visionLimiterAuth } = require("./_ratelimit");
const { getUserFromRequest } = require("./_auth");
```

- [ ] **Step 2: Update the rate limit check in `api/ocr-regions.js`**

```javascript
// Replace:
const limited = await checkLimit(visionLimiter, req);
if (limited) return res.status(429).json(limited);
// With:
const user    = await getUserFromRequest(req);
const userId  = user?.id || null;
const limited = await checkLimitForUser(visionLimiter, visionLimiterAuth, req, userId);
if (limited) return res.status(429).json(limited);
```

- [ ] **Step 3: Update `api/learn.js` imports**

```javascript
// Replace:
const { checkLimit, translateLimiter } = require("./_ratelimit");
// With:
const { checkLimitForUser, translateLimiter, translateLimiterAuth } = require("./_ratelimit");
const { getUserFromRequest } = require("./_auth");
```

- [ ] **Step 4: Update the rate limit check in `api/learn.js`**

```javascript
// Replace:
const limited = await checkLimit(translateLimiter, req);
if (limited) return res.status(429).json(limited);
// With:
const user    = await getUserFromRequest(req);
const userId  = user?.id || null;
const limited = await checkLimitForUser(translateLimiter, translateLimiterAuth, req, userId);
if (limited) return res.status(429).json(limited);
```

- [ ] **Step 5: Test**
  - Translate while logged out → rate limit key is the IP (check Upstash dashboard: `rl:translate:anon:<ip>`)
  - Translate while logged in → rate limit key is user ID (check Upstash dashboard: `rl:translate:auth:user:<uuid>`)

- [ ] **Step 6: Commit and push**

```bash
git add api/ocr-regions.js api/learn.js
git commit -m "feat: ocr and learn endpoints use user-aware rate limiting"
git push
```

---

## Self-Review Checklist

- [x] Anonymous users still work at 30/hr
- [x] Authenticated users get 100/hr translate, 30/hr vision
- [x] Redis keys are separate for anon vs auth (no collision)
- [x] Fail-open if Redis is down
- [x] All 3 endpoints updated
- [x] No placeholder steps
