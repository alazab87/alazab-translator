// Builds the Chrome Web Store upload bundle: node scripts/package-extension.js
// Icons must exist first — run `npm run icons`.

const { execFileSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC  = path.join(ROOT, "chrome-extension");
const OUT  = path.join(ROOT, "metranslate-extension.zip");

const REQUIRED = [
  "manifest.json", "background.js", "content.js",
  "popup.html", "popup.js", "popup.css",
  "icons/icon16.png", "icons/icon48.png", "icons/icon128.png",
];

const missing = REQUIRED.filter(f => !fs.existsSync(path.join(SRC, f)));
if (missing.length) {
  console.error("Missing required files:\n  " + missing.join("\n  "));
  console.error("\nIf the icons are missing, run: npm run icons");
  process.exit(1);
}

fs.rmSync(OUT, { force: true });

// Compress-Archive is built into Windows PowerShell — avoids depending on `zip`.
execFileSync("powershell", [
  "-NoProfile", "-Command",
  `Compress-Archive -Path '${SRC}\\*' -DestinationPath '${OUT}' -Force`,
], { stdio: "inherit" });

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`\nBuilt ${path.basename(OUT)} (${kb} KB) — upload this at`);
console.log("https://chrome.google.com/webstore/devconsole");
