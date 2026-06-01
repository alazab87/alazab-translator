# Login System (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password + magic-link authentication to MeTranslate using Supabase, so users can log in and have their identity available for per-user rate limiting and future features.

**Architecture:** Supabase handles all auth (sign-up, sign-in, magic link, session refresh). The frontend uses the Supabase JS CDN client; the backend uses the Supabase service-role key to verify JWT tokens sent in the `Authorization` header. Anonymous users still work — login is optional but unlocks higher limits.

**Tech Stack:** Supabase Auth, `@supabase/supabase-js` v2 (CDN on frontend, npm on backend), Vercel env vars, vanilla JS

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `api/_supabase.js` | CREATE | Shared server-side Supabase client |
| `api/_auth.js` | CREATE | `getUserFromRequest(req)` helper — verifies JWT, returns user or null |
| `api/translate.js` | MODIFY | Call `getUserFromRequest`, pass userId to rate limiter |
| `api/ocr-regions.js` | MODIFY | Same |
| `api/learn.js` | MODIFY | Same |
| `public/index.html` | MODIFY | Auth UI: login modal, user avatar menu, session state |
| `vercel.json` | CHECK | Confirm env vars are declared |

---

## Pre-requisites (do these manually before coding)

- [ ] Go to https://supabase.com → New project → name it `metranslate`
- [ ] Copy: **Project URL** and **anon/public key** → needed for frontend
- [ ] Copy: **service_role key** (Settings → API) → needed for backend
- [ ] In Supabase dashboard: Authentication → Settings → enable **Email** provider
- [ ] In Supabase dashboard: Authentication → Settings → set Site URL to `https://amatranslate.app`
- [ ] Add these to Vercel env vars (Settings → Environment Variables):
  - `SUPABASE_URL` = your project URL
  - `SUPABASE_ANON_KEY` = anon/public key
  - `SUPABASE_SERVICE_ROLE_KEY` = service_role key

---

## Task 1: Server-side Supabase client + auth helper

**Files:**
- Create: `api/_supabase.js`
- Create: `api/_auth.js`

- [ ] **Step 1: Install Supabase server SDK**

```bash
cd "C:\Users\alaza\Claode folder"
npm install @supabase/supabase-js
```

Expected: `@supabase/supabase-js` appears in `package.json` dependencies.

- [ ] **Step 2: Create `api/_supabase.js`**

```javascript
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabase };
```

- [ ] **Step 3: Create `api/_auth.js`**

```javascript
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
```

- [ ] **Step 4: Verify the files exist**

```bash
ls "C:\Users\alaza\Claode folder\api\_supabase.js"
ls "C:\Users\alaza\Claode folder\api\_auth.js"
```

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.js api/_auth.js package.json package-lock.json
git commit -m "feat: add Supabase server client and auth helper"
git push
```

---

## Task 2: Wire auth into API endpoints

**Files:**
- Modify: `api/translate.js` (top of handler, after rate limit check)
- Modify: `api/ocr-regions.js` (same pattern)
- Modify: `api/learn.js` (same pattern)

- [ ] **Step 1: Update `api/translate.js` — add user extraction**

Add after the existing imports at the top:
```javascript
const { getUserFromRequest } = require("./_auth");
```

Inside the handler, after the rate limit check and before translation logic, add:
```javascript
const user = await getUserFromRequest(req);
// user is null for anonymous, or { id, email } for logged-in
// Pass user.id to future per-user limiting (Plan 2)
// For now just attach it to req for logging
req.userId = user?.id || null;
```

- [ ] **Step 2: Apply the same change to `api/ocr-regions.js`**

```javascript
// Add at top:
const { getUserFromRequest } = require("./_auth");

// Add inside handler after rate limit check:
const user = await getUserFromRequest(req);
req.userId = user?.id || null;
```

- [ ] **Step 3: Apply the same change to `api/learn.js`**

```javascript
// Add at top:
const { getUserFromRequest } = require("./_auth");

// Add inside handler after rate limit check:
const user = await getUserFromRequest(req);
req.userId = user?.id || null;
```

- [ ] **Step 4: Commit**

```bash
git add api/translate.js api/ocr-regions.js api/learn.js
git commit -m "feat: extract user identity from JWT in API endpoints"
git push
```

---

## Task 3: Frontend auth UI — modal + session state

**Files:**
- Modify: `public/index.html` (add Supabase CDN, auth modal, user menu, session logic)

- [ ] **Step 1: Add Supabase CDN script to `<head>` (after the analytics script)**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

- [ ] **Step 2: Add CSS for auth UI — insert before `</style>`**

```css
/* ── Auth ─────────────────────────────────────────────────────────── */
.auth-btn { position:absolute; top:1rem; left:1rem; background:rgba(108,99,255,0.12); border:1px solid var(--accent); border-radius:2rem; color:var(--accent2); font-family:inherit; font-size:0.75rem; font-weight:700; padding:0.3rem 0.85rem; cursor:pointer; transition:all 0.2s; }
.auth-btn:hover { background:rgba(108,99,255,0.25); }
.auth-avatar { position:absolute; top:1rem; left:1rem; width:2rem; height:2rem; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); border:none; color:#fff; font-size:0.75rem; font-weight:700; cursor:pointer; display:none; align-items:center; justify-content:center; }
.auth-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; align-items:center; justify-content:center; }
.auth-modal-overlay.show { display:flex; }
.auth-modal { background:var(--surface); border:1px solid var(--border); border-radius:1rem; padding:1.5rem; width:90%; max-width:360px; display:flex; flex-direction:column; gap:1rem; }
.auth-modal h2 { font-size:1.1rem; color:var(--accent2); margin:0; text-align:center; }
.auth-tabs { display:flex; gap:0.4rem; }
.auth-tab { flex:1; background:var(--surface2); border:1px solid var(--border); border-radius:0.5rem; color:var(--text-muted); font-family:inherit; font-size:0.82rem; padding:0.4rem; cursor:pointer; transition:all 0.15s; }
.auth-tab.active { background:rgba(108,99,255,0.15); border-color:var(--accent); color:var(--accent2); font-weight:700; }
.auth-input { background:var(--surface2); border:1px solid var(--border); border-radius:0.6rem; color:var(--text); font-family:inherit; font-size:0.9rem; padding:0.55rem 0.8rem; outline:none; transition:border-color 0.2s; width:100%; box-sizing:border-box; }
.auth-input:focus { border-color:var(--accent); }
.auth-submit { background:linear-gradient(135deg,var(--accent),var(--accent2)); border:none; border-radius:0.6rem; color:#fff; font-family:inherit; font-size:0.9rem; font-weight:700; padding:0.65rem; cursor:pointer; transition:opacity 0.2s; }
.auth-submit:hover { opacity:0.88; }
.auth-divider { text-align:center; color:var(--text-muted); font-size:0.75rem; }
.auth-magic-btn { background:none; border:1px solid var(--border); border-radius:0.6rem; color:var(--text-muted); font-family:inherit; font-size:0.82rem; padding:0.55rem; cursor:pointer; transition:all 0.15s; }
.auth-magic-btn:hover { border-color:var(--accent); color:var(--accent2); }
.auth-msg { font-size:0.8rem; text-align:center; min-height:1.2em; }
.auth-msg.error { color:#ef4444; }
.auth-msg.success { color:#22c55e; }
.auth-close { background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; align-self:flex-end; padding:0; line-height:1; }
/* User dropdown */
.auth-dropdown { display:none; position:absolute; top:3.2rem; left:1rem; background:var(--surface2); border:1px solid var(--border); border-radius:0.75rem; padding:0.4rem; z-index:200; min-width:160px; box-shadow:0 8px 24px rgba(0,0,0,0.4); }
.auth-dropdown.open { display:block; }
.auth-dd-email { font-size:0.72rem; color:var(--text-muted); padding:0.3rem 0.6rem 0.5rem; border-bottom:1px solid var(--border); margin-bottom:0.3rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px; }
.auth-dd-item { background:none; border:none; color:var(--text); font-family:inherit; font-size:0.82rem; padding:0.4rem 0.6rem; cursor:pointer; border-radius:0.4rem; width:100%; text-align:left; transition:background 0.15s; }
.auth-dd-item:hover { background:rgba(108,99,255,0.1); }
.auth-dd-item.danger { color:#ef4444; }
```

- [ ] **Step 3: Add auth modal HTML — insert before `</main>`**

```html
<!-- Auth modal -->
<button class="auth-btn" id="authBtn">Sign In</button>
<button class="auth-avatar" id="authAvatar"></button>
<div class="auth-dropdown" id="authDropdown">
  <div class="auth-dd-email" id="authDdEmail"></div>
  <button class="auth-dd-item danger" id="authSignOutBtn">Sign out</button>
</div>

<div class="auth-modal-overlay" id="authOverlay">
  <div class="auth-modal">
    <button class="auth-close" id="authClose">✕</button>
    <h2>Welcome to MeTranslate</h2>
    <div class="auth-tabs">
      <button class="auth-tab active" data-authtab="signin">Sign In</button>
      <button class="auth-tab" data-authtab="signup">Sign Up</button>
    </div>
    <input class="auth-input" id="authEmail" type="email" placeholder="Email address" autocomplete="email">
    <input class="auth-input" id="authPassword" type="password" placeholder="Password" autocomplete="current-password">
    <button class="auth-submit" id="authSubmit">Sign In</button>
    <div class="auth-divider">— or —</div>
    <button class="auth-magic-btn" id="authMagicBtn">✉️ Send magic link (no password)</button>
    <p class="auth-msg" id="authMsg"></p>
  </div>
</div>
```

- [ ] **Step 4: Add auth JavaScript — insert just before the closing `</script>` tag**

```javascript
// ════════════════════════════════════════════════════════════════════
// ── AUTH ────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
(function initAuth() {
  // Replace with your actual Supabase project URL and anon key
  const SUPABASE_URL      = "https://YOUR_PROJECT_ID.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ── DOM refs ────────────────────────────────────────────────────
  const authBtn      = document.getElementById("authBtn");
  const authAvatar   = document.getElementById("authAvatar");
  const authDropdown = document.getElementById("authDropdown");
  const authOverlay  = document.getElementById("authOverlay");
  const authClose    = document.getElementById("authClose");
  const authSubmit   = document.getElementById("authSubmit");
  const authMagicBtn = document.getElementById("authMagicBtn");
  const authMsg      = document.getElementById("authMsg");
  const authEmail    = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authDdEmail  = document.getElementById("authDdEmail");
  const authSignOut  = document.getElementById("authSignOutBtn");

  let currentTab = "signin";
  let currentUser = null;

  // ── Tab switching ────────────────────────────────────────────────
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.authtab;
      authSubmit.textContent = currentTab === "signin" ? "Sign In" : "Create Account";
      authMsg.textContent = "";
    });
  });

  // ── Open / close modal ───────────────────────────────────────────
  authBtn.addEventListener("click", () => authOverlay.classList.add("show"));
  authClose.addEventListener("click", () => { authOverlay.classList.remove("show"); authMsg.textContent = ""; });
  authOverlay.addEventListener("click", e => { if (e.target === authOverlay) authOverlay.classList.remove("show"); });

  // ── Avatar dropdown ──────────────────────────────────────────────
  authAvatar.addEventListener("click", e => {
    e.stopPropagation();
    authDropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => authDropdown.classList.remove("open"));

  // ── Sign out ─────────────────────────────────────────────────────
  authSignOut.addEventListener("click", async () => {
    await sb.auth.signOut();
    authDropdown.classList.remove("open");
  });

  // ── Submit (sign in or sign up) ──────────────────────────────────
  authSubmit.addEventListener("click", async () => {
    const email    = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) { showMsg("Please enter email and password.", "error"); return; }

    authSubmit.disabled = true;
    authSubmit.textContent = "Please wait…";

    const { error } = currentTab === "signup"
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });

    authSubmit.disabled = false;
    authSubmit.textContent = currentTab === "signin" ? "Sign In" : "Create Account";

    if (error) { showMsg(error.message, "error"); }
    else if (currentTab === "signup") { showMsg("✓ Check your email to confirm your account.", "success"); }
    else { authOverlay.classList.remove("show"); }
  });

  // Magic link
  authMagicBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    if (!email) { showMsg("Enter your email first.", "error"); return; }
    authMagicBtn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email });
    authMagicBtn.disabled = false;
    showMsg(error ? error.message : "✓ Magic link sent! Check your email.", error ? "error" : "success");
  });

  function showMsg(text, type) {
    authMsg.textContent = text;
    authMsg.className = `auth-msg ${type}`;
  }

  // ── Session state listener ───────────────────────────────────────
  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
    // Store token for API calls
    if (session?.access_token) {
      window._meTranslateToken = session.access_token;
    } else {
      window._meTranslateToken = null;
    }
  });

  // Restore session on load
  sb.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    if (session?.access_token) window._meTranslateToken = session.access_token;
    updateAuthUI();
  });

  function updateAuthUI() {
    if (currentUser) {
      authBtn.style.display    = "none";
      authAvatar.style.display = "flex";
      const initials = (currentUser.email || "U").slice(0, 2).toUpperCase();
      authAvatar.textContent   = initials;
      authDdEmail.textContent  = currentUser.email;
    } else {
      authBtn.style.display    = "";
      authAvatar.style.display = "none";
    }
  }
})();
```

- [ ] **Step 5: Wire the token into fetch calls — find the `fetch("/api/translate"` call and add auth header**

Search for the streaming fetch in translate and add the header:
```javascript
// Find this pattern in the translate fetch call:
headers: { "Content-Type": "application/json", "Accept": "text/event-stream" }
// Change to:
headers: {
  "Content-Type": "application/json",
  "Accept": "text/event-stream",
  ...(window._meTranslateToken ? { "Authorization": `Bearer ${window._meTranslateToken}` } : {})
}
```

Do the same for all other API fetch calls (`/api/learn`, `/api/wordcard`, `/api/alternatives`, `/api/ocr-regions`).

- [ ] **Step 6: Replace placeholder values with real Supabase credentials**

In the JS you just added, replace:
- `"https://YOUR_PROJECT_ID.supabase.co"` → your actual Supabase project URL
- `"YOUR_ANON_KEY"` → your actual anon/public key (safe to embed in frontend)

- [ ] **Step 7: Test in browser**
  - Open `amatranslate.app`
  - Click "Sign In" → modal appears
  - Sign up with a test email → check email for confirmation
  - Sign in → avatar appears top-left
  - Open DevTools → Network tab → make a translation → confirm `Authorization: Bearer ...` header is present
  - Sign out → "Sign In" button returns

- [ ] **Step 8: Commit and push**

```bash
git add public/index.html
git commit -m "feat: add Supabase auth — sign in, sign up, magic link, session persistence"
git push
```

---

## Self-Review Checklist

- [x] Sign up flow covered (Task 3)
- [x] Sign in flow covered (Task 3)
- [x] Magic link covered (Task 3)
- [x] Sign out covered (Task 3)
- [x] Session persistence on reload covered (Task 3, `getSession()` on load)
- [x] Token sent to API endpoints covered (Task 3, Step 5)
- [x] Server-side token verification covered (Tasks 1–2)
- [x] Anonymous users still work (Tasks 2, `getUserFromRequest` returns null gracefully)
- [x] No placeholder steps — all code is complete
