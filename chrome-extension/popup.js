const API_BASE = "https://amatranslate.app";

const inputText    = document.getElementById("inputText");
const outputText   = document.getElementById("outputText");
const srcSel       = document.getElementById("srcSel");
const tgtSel       = document.getElementById("tgtSel");
const swapBtn      = document.getElementById("swapBtn");
const translateBtn = document.getElementById("translateBtn");
const copyBtn      = document.getElementById("copyBtn");
const speakBtn     = document.getElementById("speakBtn");
const clearBtn     = document.getElementById("clearBtn");
const statusEl     = document.getElementById("status");

let currentTranslation = "";
let isTranslating = false;

// ── Translate ──────────────────────────────────────────────────────
async function translate() {
  if (isTranslating) return;
  const text = inputText.value.trim();
  if (!text) return;
  isTranslating = true;

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
    isTranslating = false;
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
  try {
    await navigator.clipboard.writeText(currentTranslation);
    copyBtn.textContent = "✓ Copied!";
  } catch {
    copyBtn.textContent = "✗ Failed";
  }
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

// Restore language prefs first, then auto-fill — order matters to avoid wrong-language translate
chrome.storage.sync.get(["extSrcLang", "extTgtLang"], ({ extSrcLang, extTgtLang }) => {
  if (extSrcLang) srcSel.value = extSrcLang;
  if (extTgtLang) tgtSel.value = extTgtLang;
  // Auto-fill selected text only after language prefs are restored
  chrome.storage.session.get("selectedText", ({ selectedText }) => {
    if (selectedText) {
      inputText.value = selectedText;
      chrome.storage.session.remove("selectedText");
      translate();
    }
  });
});
