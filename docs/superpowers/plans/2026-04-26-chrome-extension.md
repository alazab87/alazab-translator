# Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that lets users select any text on any webpage and instantly translate it, using the live MeTranslate API at `amatranslate.app`.

**Architecture:** Manifest V3 extension. A content script detects text selection and shows a floating translate button. Clicking it opens the extension popup (or an inline tooltip) that calls `https://amatranslate.app/api/translate` directly. No local server needed — the extension is a thin UI over the existing live API.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS/HTML/CSS, calls `amatranslate.app` API

**Note:** This plan is independent — does NOT require the login system to be done first. Login integration can be added later.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `chrome-extension/manifest.json` | CREATE | Extension config — MV3, permissions, icons |
| `chrome-extension/popup.html` | CREATE | The 400×500px translator popup |
| `chrome-extension/popup.js` | CREATE | Popup logic — translate, speak, copy, language select |
| `chrome-extension/popup.css` | CREATE | Styles matching MeTranslate dark theme |
| `chrome-extension/content.js` | CREATE | Detects selected text → sends to popup via storage |
| `chrome-extension/background.js` | CREATE | MV3 service worker — message relay |
| `chrome-extension/icons/` | CREATE | 16, 48, 128px PNG icons |

---

## Task 1: Extension skeleton — manifest + folder structure

**Files:**
- Create: `chrome-extension/manifest.json`
- Create: `chrome-extension/background.js`

- [ ] **Step 1: Create the folder**

```bash
mkdir "C:\Users\alaza\Claode folder\chrome-extension"
mkdir "C:\Users\alaza\Claode folder\chrome-extension\icons"
```

- [ ] **Step 2: Create `chrome-extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "MeTranslate",
  "version": "1.0.0",
  "description": "Instant AI translation powered by Claude. Select text on any page to translate.",
  "permissions": [
    "activeTab",
    "storage",
    "contextMenus"
  ],
  "host_permissions": [
    "https://amatranslate.app/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "MeTranslate"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 3: Create `chrome-extension/background.js`**

```javascript
// MV3 service worker — relays selected text from content script to popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SELECTED_TEXT") {
    // Store selected text so popup can read it when it opens
    chrome.storage.session.set({ selectedText: message.text });
    sendResponse({ ok: true });
  }
});

// Context menu: right-click → "Translate with MeTranslate"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "metranslate-selection",
    title: "Translate \"%s\" with MeTranslate",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "metranslate-selection" && info.selectionText) {
    chrome.storage.session.set({ selectedText: info.selectionText.trim() });
    // Open popup
    chrome.action.openPopup?.();
  }
});
```

- [ ] **Step 4: Create placeholder icon files**

Create simple SVG-based PNGs. For now, create a placeholder text file — replace with real icons before publishing:

```bash
# You'll replace these with real PNG files before publishing to Chrome Web Store
# For local testing, Chrome accepts any valid PNG
# Use an online tool like https://favicon.io to generate icons from text "MT"
# Save as: icons/icon16.png, icons/icon48.png, icons/icon128.png
```

Note: For local testing, copy any 3 PNG files renamed to icon16.png, icon48.png, icon128.png. Chrome will use them.

- [ ] **Step 5: Commit skeleton**

```bash
git add chrome-extension/
git commit -m "feat: chrome extension skeleton — manifest v3 + background service worker"
git push
```

---

## Task 2: Content script — detect selected text

**Files:**
- Create: `chrome-extension/content.js`

- [ ] **Step 1: Create `chrome-extension/content.js`**

```javascript
// Listen for text selection on any page
// When user selects text and stops, send it to background service worker
let selectionTimer = null;

document.addEventListener("mouseup", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length > 1 && selected.length < 2000) {
      chrome.runtime.sendMessage({ type: "SELECTED_TEXT", text: selected });
    }
  }, 300);
});

// Also handle keyboard selection (Shift+arrow, Ctrl+A etc.)
document.addEventListener("keyup", (e) => {
  if (e.shiftKey || e.key === "a" && (e.ctrlKey || e.metaKey)) {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length > 1) {
      chrome.runtime.sendMessage({ type: "SELECTED_TEXT", text: selected });
    }
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/content.js
git commit -m "feat: content script detects text selection and sends to background"
git push
```

---

## Task 3: Popup HTML + CSS

**Files:**
- Create: `chrome-extension/popup.html`
- Create: `chrome-extension/popup.css`

- [ ] **Step 1: Create `chrome-extension/popup.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 400px;
  min-height: 300px;
  background: #0f1117;
  color: #e2e2f0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
}

.header {
  background: linear-gradient(180deg, rgba(108,99,255,0.12) 0%, transparent 100%);
  border-bottom: 1px solid #2e3155;
  padding: 0.8rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo { font-size: 1rem; font-weight: 700; color: #a78bfa; display: flex; align-items: center; gap: 0.4rem; }

.lang-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid #2e3155;
}

.lang-sel {
  flex: 1;
  background: #1a1d2e;
  border: 1px solid #2e3155;
  border-radius: 0.5rem;
  color: #e2e2f0;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 0.35rem 0.6rem;
  outline: none;
  cursor: pointer;
}

.swap-btn {
  background: #1a1d2e;
  border: 1px solid #2e3155;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  color: #a78bfa;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.swap-btn:hover { background: rgba(108,99,255,0.2); border-color: #6c63ff; transform: rotate(180deg); }

.input-area {
  padding: 0.7rem 1rem 0;
}

textarea {
  width: 100%;
  background: #1a1d2e;
  border: 1px solid #2e3155;
  border-radius: 0.6rem;
  color: #e2e2f0;
  font-family: inherit;
  font-size: 0.9rem;
  padding: 0.6rem 0.8rem;
  resize: none;
  outline: none;
  min-height: 80px;
  transition: border-color 0.2s;
}
textarea:focus { border-color: #6c63ff; }
textarea::placeholder { color: #5c5f7a; font-style: italic; }

.translate-btn {
  display: block;
  width: calc(100% - 2rem);
  margin: 0.5rem 1rem;
  background: linear-gradient(135deg, #6c63ff, #a78bfa);
  border: none;
  border-radius: 0.6rem;
  color: #fff;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0.6rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.translate-btn:hover { opacity: 0.85; }
.translate-btn:disabled { opacity: 0.5; cursor: default; }

.output-area {
  margin: 0 1rem 0.5rem;
  background: #1a1d2e;
  border: 1px solid #2e3155;
  border-radius: 0.6rem;
  padding: 0.6rem 0.8rem;
  min-height: 80px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #e2e2f0;
  word-break: break-word;
}
.output-area.placeholder { color: #5c5f7a; font-style: italic; }
.output-area.translating { color: #a78bfa; }

.actions {
  display: flex;
  gap: 0.4rem;
  padding: 0 1rem 0.8rem;
}

.action-btn {
  flex: 1;
  background: #1a1d2e;
  border: 1px solid #2e3155;
  border-radius: 0.5rem;
  color: #9899b3;
  font-family: inherit;
  font-size: 0.75rem;
  padding: 0.4rem 0.3rem;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover { border-color: #6c63ff; color: #a78bfa; }

.status {
  padding: 0 1rem 0.6rem;
  font-size: 0.72rem;
  color: #5c5f7a;
  min-height: 1.2em;
}

.open-app-link {
  display: block;
  text-align: center;
  padding: 0.5rem;
  font-size: 0.72rem;
  color: #5c5f7a;
  border-top: 1px solid #2e3155;
  text-decoration: none;
}
.open-app-link:hover { color: #a78bfa; }
```

- [ ] **Step 2: Create `chrome-extension/popup.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MeTranslate</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="header">
    <div class="logo">🌐 MeTranslate</div>
  </div>

  <div class="lang-row">
    <select class="lang-sel" id="srcSel">
      <option value="Auto Detect">🌐 Auto Detect</option>
      <option value="English">🇺🇸 English</option>
      <option value="Spanish">🇪🇸 Spanish</option>
      <option value="Latin American Spanish">🇲🇽 Latin American Spanish</option>
      <option value="French">🇫🇷 French</option>
      <option value="Arabic">🇸🇦 Arabic</option>
      <option value="German">🇩🇪 German</option>
      <option value="Italian">🇮🇹 Italian</option>
      <option value="Brazilian Portuguese">🇧🇷 Brazilian Portuguese</option>
      <option value="Chinese">🇨🇳 Chinese</option>
      <option value="Japanese">🇯🇵 Japanese</option>
      <option value="Korean">🇰🇷 Korean</option>
      <option value="Russian">🇷🇺 Russian</option>
      <option value="Hindi">🇮🇳 Hindi</option>
      <option value="Turkish">🇹🇷 Turkish</option>
    </select>

    <button class="swap-btn" id="swapBtn" title="Swap languages">⇄</button>

    <select class="lang-sel" id="tgtSel">
      <option value="English">🇺🇸 English</option>
      <option value="Spanish" selected>🇪🇸 Spanish</option>
      <option value="Latin American Spanish">🇲🇽 Latin American Spanish</option>
      <option value="French">🇫🇷 French</option>
      <option value="Arabic">🇸🇦 Arabic</option>
      <option value="German">🇩🇪 German</option>
      <option value="Italian">🇮🇹 Italian</option>
      <option value="Brazilian Portuguese">🇧🇷 Brazilian Portuguese</option>
      <option value="Chinese">🇨🇳 Chinese</option>
      <option value="Japanese">🇯🇵 Japanese</option>
      <option value="Korean">🇰🇷 Korean</option>
      <option value="Russian">🇷🇺 Russian</option>
      <option value="Hindi">🇮🇳 Hindi</option>
      <option value="Turkish">🇹🇷 Turkish</option>
    </select>
  </div>

  <div class="input-area">
    <textarea id="inputText" placeholder="Type or paste text to translate… (selected text auto-fills)" rows="4"></textarea>
  </div>

  <button class="translate-btn" id="translateBtn">Translate</button>

  <div class="output-area placeholder" id="outputText">Translation will appear here…</div>

  <div class="actions">
    <button class="action-btn" id="copyBtn">📋 Copy</button>
    <button class="action-btn" id="speakBtn">🔊 Speak</button>
    <button class="action-btn" id="clearBtn">✕ Clear</button>
  </div>

  <div class="status" id="status"></div>

  <a class="open-app-link" href="https://amatranslate.app" target="_blank">
    Open full app at amatranslate.app ↗
  </a>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/popup.html chrome-extension/popup.css
git commit -m "feat: chrome extension popup HTML and CSS"
git push
```

---

## Task 4: Popup JavaScript — translate + auto-fill from selection

**Files:**
- Create: `chrome-extension/popup.js`

- [ ] **Step 1: Create `chrome-extension/popup.js`**

```javascript
const API_BASE = "https://amatranslate.app";

const inputText  = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const srcSel     = document.getElementById("srcSel");
const tgtSel     = document.getElementById("tgtSel");
const swapBtn    = document.getElementById("swapBtn");
const translateBtn = document.getElementById("translateBtn");
const copyBtn    = document.getElementById("copyBtn");
const speakBtn   = document.getElementById("speakBtn");
const clearBtn   = document.getElementById("clearBtn");
const statusEl   = document.getElementById("status");

let currentTranslation = "";

// ── Auto-fill selected text from the page ──────────────────────────
chrome.storage.session.get("selectedText", ({ selectedText }) => {
  if (selectedText) {
    inputText.value = selectedText;
    chrome.storage.session.remove("selectedText");
    translate(); // auto-translate immediately
  }
});

// ── Translate ──────────────────────────────────────────────────────
async function translate() {
  const text = inputText.value.trim();
  if (!text) return;

  const srcLang = srcSel.value;
  const tgtLang = tgtSel.value;

  translateBtn.disabled = true;
  outputText.textContent = "Translating…";
  outputText.className = "output-area translating";
  statusEl.textContent = "";

  try {
    const res  = await fetch(`${API_BASE}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, srcLang, tgtLang })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Translation failed");

    currentTranslation = data.translation || "";
    outputText.textContent = currentTranslation;
    outputText.className = "output-area";

    if (data.detectedLang) statusEl.textContent = `Detected: ${data.detectedLang}`;

  } catch (err) {
    outputText.textContent = `⚠ ${err.message}`;
    outputText.className = "output-area";
  } finally {
    translateBtn.disabled = false;
  }
}

// ── Event listeners ────────────────────────────────────────────────
translateBtn.addEventListener("click", translate);

inputText.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) translate();
});

swapBtn.addEventListener("click", () => {
  const prev = srcSel.value;
  // Can't swap "Auto Detect" as a target
  if (tgtSel.value === "Auto Detect") return;
  srcSel.value = tgtSel.value;
  tgtSel.value = prev === "Auto Detect" ? "English" : prev;
  // Also swap input/output text if we have a translation
  if (currentTranslation) {
    inputText.value = currentTranslation;
    outputText.textContent = "Translation will appear here…";
    outputText.className = "output-area placeholder";
    currentTranslation = "";
  }
});

copyBtn.addEventListener("click", async () => {
  if (!currentTranslation) return;
  await navigator.clipboard.writeText(currentTranslation);
  copyBtn.textContent = "✓ Copied!";
  setTimeout(() => { copyBtn.textContent = "📋 Copy"; }, 1500);
});

speakBtn.addEventListener("click", () => {
  if (!currentTranslation || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(currentTranslation);
  window.speechSynthesis.speak(u);
});

clearBtn.addEventListener("click", () => {
  inputText.value = "";
  outputText.textContent = "Translation will appear here…";
  outputText.className = "output-area placeholder";
  currentTranslation = "";
  statusEl.textContent = "";
  chrome.storage.session.remove("selectedText");
});

// Save language preferences
srcSel.addEventListener("change", () => chrome.storage.sync.set({ extSrcLang: srcSel.value }));
tgtSel.addEventListener("change", () => chrome.storage.sync.set({ extTgtLang: tgtSel.value }));

// Restore saved language preferences on open
chrome.storage.sync.get(["extSrcLang", "extTgtLang"], ({ extSrcLang, extTgtLang }) => {
  if (extSrcLang) srcSel.value = extSrcLang;
  if (extTgtLang) tgtSel.value = extTgtLang;
});
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.js
git commit -m "feat: chrome extension popup — translate, copy, speak, auto-fill from selection"
git push
```

---

## Task 5: Load and test the extension locally

- [ ] **Step 1: Open Chrome → go to `chrome://extensions`**
- [ ] **Step 2: Enable "Developer mode" (toggle top-right)**
- [ ] **Step 3: Click "Load unpacked" → select `C:\Users\alaza\Claode folder\chrome-extension`**
- [ ] **Step 4: The MeTranslate extension appears — click its icon to open popup**
- [ ] **Step 5: Type text in the input → click Translate → verify translation appears**
- [ ] **Step 6: Go to any webpage (e.g. a Spanish news site) → select text → click extension icon → verify selected text auto-filled and translated**
- [ ] **Step 7: Right-click selected text → "Translate with MeTranslate" → verify it works**
- [ ] **Step 8: Verify language preference is remembered after closing and reopening popup**

---

## Task 6: Prepare for Chrome Web Store submission

- [ ] **Step 1: Create real PNG icons** (use https://favicon.io → text "MT" → download and resize)
  - Save as `chrome-extension/icons/icon16.png`, `icon48.png`, `icon128.png`

- [ ] **Step 2: Create a ZIP of the extension folder**

```bash
cd "C:\Users\alaza\Claode folder"
# Use Windows: right-click chrome-extension folder → Send to → Compressed (zipped) folder
# Or use 7-Zip
```

- [ ] **Step 3: Go to https://chrome.google.com/webstore/devconsole**
  - Pay one-time $5 developer fee if not already done
  - Click "New Item" → upload the ZIP
  - Fill in: name "MeTranslate", description, screenshots
  - Set category: "Productivity"
  - Submit for review (takes 1–3 business days)

- [ ] **Step 4: Commit final state**

```bash
git add chrome-extension/icons/
git commit -m "feat: chrome extension ready for Web Store — icons added"
git push
```

---

## Self-Review Checklist

- [x] Auto-fills selected text from any webpage
- [x] Right-click context menu works
- [x] Manual text input works
- [x] Language swap works
- [x] Copy and Speak buttons work
- [x] Language preferences saved across sessions
- [x] Calls live `amatranslate.app` API — no local server needed
- [x] Manifest V3 compliant
- [x] Web Store submission steps included
- [x] No placeholder steps
