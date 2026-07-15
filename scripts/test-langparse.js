// Exercises the <lang> stream parser from api/translate.js against realistic
// token splits, including a model that ignores the format entirely.

const LANG_OPEN = "<lang>", LANG_CLOSE = "</lang>", LANG_GIVEUP_CHARS = 60;

function run(chunks, autoDetect) {
  let translation = "", detected = null, pending = autoDetect, buf = "";
  let trimLeading = autoDetect;
  const emit = t => {
    if (trimLeading) {
      t = t.replace(/^\s+/, "");
      if (!t) return;
      trimLeading = false;
    }
    translation += t;
  };

  for (const text of chunks) {
    if (!pending) { emit(text); continue; }
    buf += text;
    const close = buf.indexOf(LANG_CLOSE);
    if (close !== -1) {
      const lang = buf.slice(buf.indexOf(LANG_OPEN) + LANG_OPEN.length, close).trim();
      if (lang) detected = lang;
      pending = false;
      const rest = buf.slice(close + LANG_CLOSE.length).replace(/^\s+/, "");
      if (rest) emit(rest);
    } else if (!LANG_OPEN.startsWith(buf.slice(0, LANG_OPEN.length)) || buf.length > LANG_GIVEUP_CHARS) {
      pending = false; emit(buf);
    }
  }
  if (pending && buf) emit(buf);
  return { translation, detected };
}

const cases = [
  { n: "tag split across many tokens",
    c: ["<", "lan", "g>", "Span", "ish", "</la", "ng>", "Hola ", "mundo"], a: true,
    want: { translation: "Hola mundo", detected: "Spanish" } },

  { n: "whole tag in one token",
    c: ["<lang>French</lang>Bonjour", " le monde"], a: true,
    want: { translation: "Bonjour le monde", detected: "French" } },

  { n: "newline between tag and translation",
    c: ["<lang>German</lang>\n\n", "Guten Tag"], a: true,
    want: { translation: "Guten Tag", detected: "German" } },

  // Regression: seen in production. The tag closed exactly on a token boundary, so the
  // newlines arrived in the NEXT delta — after the tag's own remainder had been trimmed.
  { n: "REGRESSION: newlines arrive in the chunk AFTER the tag closes",
    c: ["<lang>Spanish</lang>", "\n\nGood morning, how are you today?"], a: true,
    want: { translation: "Good morning, how are you today?", detected: "Spanish" } },

  { n: "whitespace-only chunk between tag and text",
    c: ["<lang>Spanish</lang>", "\n", "\n", "Hola"], a: true,
    want: { translation: "Hola", detected: "Spanish" } },

  { n: "internal newlines are preserved (only leading ones are trimmed)",
    c: ["<lang>Spanish</lang>", "\n\nLine one\n\nLine two"], a: true,
    want: { translation: "Line one\n\nLine two", detected: "Spanish" } },

  { n: "MODEL IGNORES FORMAT — translation must survive intact",
    c: ["Hola ", "mundo, ", "como estas"], a: true,
    want: { translation: "Hola mundo, como estas", detected: null } },

  { n: "model emits a long preamble instead of the tag",
    c: ["I think the source language here is Spanish, and the translation is: Hola"], a: true,
    want: { translation: "I think the source language here is Spanish, and the translation is: Hola", detected: null } },

  { n: "autoDetect off — never buffers, passes straight through",
    c: ["Bonjour ", "tout ", "le monde"], a: false,
    want: { translation: "Bonjour tout le monde", detected: null } },

  { n: "stream dies mid-tag — partial buffer must not be dropped",
    c: ["<lang>Span"], a: true,
    want: { translation: "<lang>Span", detected: null } },

  { n: "translation legitimately starts with '<'",
    c: ["<lang>English</lang>", "<b>bold</b> text"], a: true,
    want: { translation: "<b>bold</b> text", detected: "English" } },

  { n: "empty lang value falls back to no detection",
    c: ["<lang></lang>Hola"], a: true,
    want: { translation: "Hola", detected: null } },
];

let pass = 0, fail = 0;
for (const t of cases) {
  const got = run(t.c, t.a);
  const ok = got.translation === t.want.translation && got.detected === t.want.detected;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${t.n}`);
  if (!ok) {
    console.log(`        translation want: ${JSON.stringify(t.want.translation)}`);
    console.log(`        translation got : ${JSON.stringify(got.translation)}`);
    console.log(`        detected want: ${JSON.stringify(t.want.detected)}  got: ${JSON.stringify(got.detected)}`);
  }
  ok ? pass++ : fail++;
}
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
