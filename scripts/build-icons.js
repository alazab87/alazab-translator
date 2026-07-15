// Renders every PNG icon the PWA and the Chrome extension need from public/icon.svg.
// Run after changing the source artwork:  node scripts/build-icons.js
//
// sharp is a devDependency-by-hand (npm i sharp --no-save) — icons are committed,
// so this only needs to run when the artwork changes, not on every deploy.

const sharp = require("sharp");
const fs    = require("fs");
const path  = require("path");

const ROOT   = path.join(__dirname, "..");
const SRC    = path.join(ROOT, "public", "icon.svg");
const PUBLIC = path.join(ROOT, "public", "icons");
const EXT    = path.join(ROOT, "chrome-extension", "icons");

// Android crops maskable icons to a circle, so the artwork has to sit inside the
// safe zone (the middle 80%). Reusing the standard icon here would clip the globe.
// This variant keeps the full-bleed background and shrinks the art to ~66%.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1a1d2e"/>
  <g transform="translate(256,256) scale(0.66) translate(-256,-262)">
    <circle cx="256" cy="230" r="150" fill="none" stroke="#6c63ff" stroke-width="18"/>
    <ellipse cx="256" cy="230" rx="65" ry="150" fill="none" stroke="#6c63ff" stroke-width="14"/>
    <line x1="110" y1="180" x2="402" y2="180" stroke="#6c63ff" stroke-width="14" stroke-linecap="round"/>
    <line x1="106" y1="230" x2="406" y2="230" stroke="#6c63ff" stroke-width="14" stroke-linecap="round"/>
    <line x1="110" y1="280" x2="402" y2="280" stroke="#6c63ff" stroke-width="14" stroke-linecap="round"/>
    <path d="M148 420 L200 390 L200 410 L312 410 L312 390 L364 420 L312 450 L312 430 L200 430 L200 450 Z" fill="#a78bfa"/>
  </g>
</svg>`;

const targets = [
  { dir: PUBLIC, name: "icon-192.png",          size: 192 },
  { dir: PUBLIC, name: "icon-512.png",          size: 512 },
  { dir: PUBLIC, name: "icon-maskable-512.png", size: 512, svg: MASKABLE_SVG },
  { dir: PUBLIC, name: "apple-touch-icon.png",  size: 180 },
  { dir: EXT,    name: "icon16.png",            size: 16  },
  { dir: EXT,    name: "icon48.png",            size: 48  },
  { dir: EXT,    name: "icon128.png",           size: 128 },
];

(async () => {
  const source = fs.readFileSync(SRC);
  [PUBLIC, EXT].forEach(d => fs.mkdirSync(d, { recursive: true }));

  for (const t of targets) {
    const input = t.svg ? Buffer.from(t.svg) : source;
    // density scales the SVG raster before resize — without it small sizes render blurry
    await sharp(input, { density: Math.max(72, Math.ceil(t.size * 1.5)) })
      .resize(t.size, t.size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(t.dir, t.name));

    const { size } = fs.statSync(path.join(t.dir, t.name));
    console.log(`  ${t.name.padEnd(24)} ${String(t.size).padStart(3)}px  ${String(size).padStart(6)} bytes`);
  }
  console.log("\nDone.");
})();
