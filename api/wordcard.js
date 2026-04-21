const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { word, srcLang, tgtLang } = req.body;
  if (!word?.trim()) return res.status(400).json({ error: "No word provided" });

  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: `You are a bilingual dictionary API. Given a word or short phrase in ${srcLang}, return a JSON object only — no markdown, no explanation, no extra text.

The JSON must have exactly these fields:
{
  "translation": "the word/phrase translated to ${tgtLang}",
  "partOfSpeech": "one of: noun, verb, adjective, adverb, phrase, expression, pronoun, preposition",
  "definition": "a clear, short definition written in ${tgtLang} (1–2 sentences)",
  "example": "one natural example sentence in ${tgtLang} that uses the translated word naturally",
  "synonyms": ["synonym1_in_${tgtLang}", "synonym2_in_${tgtLang}", "synonym3_in_${tgtLang}"]
}

All fields except partOfSpeech must be in ${tgtLang}. synonyms must be in ${tgtLang}. Return valid JSON only.`,
      messages: [{ role: "user", content: word.trim() }],
    });

    let raw = r.content[0].text.trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
