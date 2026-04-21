const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { text, lang } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "No text provided" });

  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: `Provide the romanization (pronunciation guide using Latin alphabet) of the following ${lang} text. Output ONLY the romanization, nothing else — no explanations, no original script.`,
      messages: [{ role: "user", content: text }],
    });
    res.json({ romanization: r.content[0].text.trim() });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
