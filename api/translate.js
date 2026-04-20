const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { text, srcLang, tgtLang, formality } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

  const formalityNote =
    formality === "formal" ? " Use formal, polite register." :
    formality === "casual" ? " Use casual, informal, everyday language." : "";

  try {
    // ── Auto detect mode: detect language + translate in one call ──
    if (srcLang === "Auto Detect") {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: `Detect the language of the input text, then translate it to ${tgtLang}.${formalityNote} Respond ONLY with valid JSON in this exact format (no markdown, no extra text): {"detectedLang":"English","translation":"translated text here"}`,
        messages: [{ role: "user", content: text }],
      });

      let raw = response.content[0].text.trim()
        .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

      const parsed = JSON.parse(raw);
      return res.json({ translation: parsed.translation, detectedLang: parsed.detectedLang });
    }

    // ── Normal translation ──
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You are Alazab Translator. Translate from ${srcLang} to ${tgtLang}. Output ONLY the translation, no explanations, no alternatives, no notes. Preserve tone, formality, idioms, and punctuation.${formalityNote}`,
      messages: [{ role: "user", content: text }],
    });

    res.json({ translation: response.content[0].text });

  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
};
