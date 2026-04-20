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
      system: `The sentence below is written in ${tgtLang}. Give exactly 3 alternative ${tgtLang} words or short phrases that could replace the specified word while keeping the same meaning. IMPORTANT: all alternatives must be in ${tgtLang} — do NOT translate to English or any other language. Keep each option short (1–3 words). Respond ONLY with a JSON array: ["alt1","alt2","alt3"]`,
      messages: [{ role: "user", content: `Sentence in ${tgtLang}: "${context}"\nWord to replace: "${word}"` }],
    });

    let raw = r.content[0].text.trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    res.json({ alternatives: JSON.parse(raw) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
