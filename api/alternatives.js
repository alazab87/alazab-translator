const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { word, context, tgtLang } = req.body;
  if (!word?.trim()) return res.status(400).json({ error: "No word provided" });

  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: `You are a translation assistant. Given a word from a ${tgtLang} translation and the full sentence for context, provide exactly 3 alternative translations for that specific word. Keep each alternative short (1–4 words). Do not repeat the original word. Respond ONLY with a JSON array: ["alt1","alt2","alt3"]`,
      messages: [{ role: "user", content: `Full sentence: "${context}"\nWord to replace: "${word}"` }],
    });

    let raw = r.content[0].text.trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    res.json({ alternatives: JSON.parse(raw) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
