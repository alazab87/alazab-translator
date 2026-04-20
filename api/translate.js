const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Languages where we show romanized pronunciation
const ROMANIZE = new Set(["Arabic", "Chinese", "Japanese"]);

function cleanJson(text) {
  return text.trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { text, srcLang, tgtLang, formality } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

  const formalityNote =
    formality === "formal" ? " Use formal, polite register." :
    formality === "casual" ? " Use casual, informal, everyday language." : "";

  const autoDetect  = srcLang === "Auto Detect";
  const needsRoman  = ROMANIZE.has(tgtLang);

  try {
    // ── All four combinations ──
    if (autoDetect && needsRoman) {
      const r = await client.messages.create({
        model: "claude-haiku-4-5", max_tokens: 1500,
        system: `Detect the source language, translate to ${tgtLang}, and provide romanization (Latin alphabet pronunciation).${formalityNote} Respond ONLY with valid JSON: {"detectedLang":"English","translation":"translated text","romanization":"romanized text"}`,
        messages: [{ role: "user", content: text }],
      });
      return res.json(JSON.parse(cleanJson(r.content[0].text)));
    }

    if (autoDetect) {
      const r = await client.messages.create({
        model: "claude-haiku-4-5", max_tokens: 1200,
        system: `Detect the language of the input text, then translate it to ${tgtLang}.${formalityNote} Respond ONLY with valid JSON: {"detectedLang":"English","translation":"translated text"}`,
        messages: [{ role: "user", content: text }],
      });
      return res.json(JSON.parse(cleanJson(r.content[0].text)));
    }

    if (needsRoman) {
      const r = await client.messages.create({
        model: "claude-haiku-4-5", max_tokens: 1500,
        system: `You are Alazab Translator. Translate from ${srcLang} to ${tgtLang} and provide romanization (pronunciation in Latin letters).${formalityNote} Respond ONLY with valid JSON: {"translation":"translated text","romanization":"romanized pronunciation"}`,
        messages: [{ role: "user", content: text }],
      });
      return res.json(JSON.parse(cleanJson(r.content[0].text)));
    }

    // ── Plain translation ──
    const r = await client.messages.create({
      model: "claude-haiku-4-5", max_tokens: 1024,
      system: `You are Alazab Translator. Translate from ${srcLang} to ${tgtLang}. Output ONLY the translation, no explanations, no alternatives, no notes. Preserve tone, formality, idioms, and punctuation.${formalityNote}`,
      messages: [{ role: "user", content: text }],
    });
    res.json({ translation: r.content[0].text });

  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
