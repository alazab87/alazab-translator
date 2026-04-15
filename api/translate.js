const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { text, direction } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

  const srcLang = direction === "en-es" ? "English" : "Spanish";
  const tgtLang = direction === "en-es" ? "Spanish" : "English";

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You are Alazab Translator. Translate from ${srcLang} to ${tgtLang}. Output ONLY the translation, no explanations, no alternatives, no notes. Preserve tone, formality, idioms, and punctuation.`,
      messages: [{ role: "user", content: text }],
    });

    res.json({ translation: response.content[0].text });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}
