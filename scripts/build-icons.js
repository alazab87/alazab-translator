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
const ANDROID = path.join(ROOT, "android", "app", "src", "main", "res");

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

// Android adaptive icons: the system draws the foreground on its own background layer
// and may crop to any shape, so the art sits transparent inside the middle 66%.
const ANDROID_FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256,256) scale(0.60) translate(-256,-262)">
    <circle cx="256" cy="230" r="150" fill="none" stroke="#6c63ff" stroke-width="18"/>
    <ellipse cx="256" cy="230" rx="65" ry="150" fill="none" stroke="#6c63ff" stroke-width="14"/>
    <line x1="110" y1="180" x2="402" y2="180" stroke="#6c63ff" stroke-width="14" stroke-linecap="round"/>
    <line x1="106" y1="230" x2="406" y2="230" stroke="#6c63ff" stroke-width="14" stroke-linecap="round"/>
    <line x1="110" y1="280" x2="402" y2="280" stroke="#6c63ff" stroke-width="14" stroke-linecap="round"/>
    <path d="M148 420 L200 390 L200 410 L312 410 L312 390 L364 420 L312 450 L312 430 L200 430 L200 450 Z" fill="#a78bfa"/>
  </g>
</svg>`;

// Legacy square/round launcher icons (pre-Android 8) — these keep the background.
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// Foregrounds are 108dp against the same dp grid, hence the larger pixel sizes.
const FG_DENSITIES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function render(input, size, out, { round = false } = {}) {
  let img = sharp(input, { density: Math.max(72, Math.ceil(size * 1.5)) }).resize(size, size);
  if (round) {
    const r = Math.floor(size / 2);
    const mask = Buffer.from(
      `<svg><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
    );
    img = img.composite([{ input: mask, blend: "dest-in" }]);
  }
  await img.png({ compressionLevel: 9 }).toFile(out);
}

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

  if (fs.existsSync(ANDROID)) {
    console.log("\n  Android launcher icons:");
    const fg = Buffer.from(ANDROID_FOREGROUND_SVG);
    for (const [density, px] of Object.entries(DENSITIES)) {
      const dir = path.join(ANDROID, `mipmap-${density}`);
      fs.mkdirSync(dir, { recursive: true });
      await render(source, px, path.join(dir, "ic_launcher.png"));
      await render(source, px, path.join(dir, "ic_launcher_round.png"), { round: true });
      await render(fg, FG_DENSITIES[density], path.join(dir, "ic_launcher_foreground.png"));
      console.log(`    mipmap-${density.padEnd(8)} launcher ${String(px).padStart(3)}px · foreground ${FG_DENSITIES[density]}px`);
    }
  } else {
    console.log("\n  (android/ not present — skipping launcher icons)");
  }

  console.log("\nDone.");
})();
