const Anthropic = require("@anthropic-ai/sdk");
const { checkLimit, translateLimiter } = require("./_ratelimit");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")   return res.status(405).end();

  const limited = await checkLimit(translateLimiter, req);
  if (limited) return res.status(429).json(limited);

  const { action, nativeLang, learnLang, topic, difficulty, word, userAnswer, correctAnswer } = req.body;

  try {
    // ── Generate: 8 flashcards for a topic ─────────────────────────────
    if (action === "generate") {
      const r = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Create 8 vocabulary flashcards for someone who speaks ${nativeLang} and is learning ${learnLang}.
Topic: ${topic}
Difficulty: ${difficulty}

Return ONLY a valid JSON array, no markdown:
[
  {
    "word": "the word in ${learnLang}",
    "translation": "translation in ${nativeLang}",
    "example_learn": "a natural example sentence in ${learnLang}",
    "example_native": "that same sentence translated to ${nativeLang}",
    "part_of_speech": "noun/verb/adjective/phrase",
    "tip": "one short memorable tip to help remember this word (in ${nativeLang})"
  }
]

Rules:
- Use common, practical vocabulary appropriate for ${difficulty} level
- Keep example sentences short (under 10 words)
- Make tips clever: etymological links, visual associations, rhymes
- No duplicate words`
        }]
      });

      let raw = r.content[0].text.trim()
        .replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/,"").trim();
      const cards = JSON.parse(raw);
      return res.json({ cards: Array.isArray(cards) ? cards : [] });
    }

    // ── Evaluate: score a typed answer ─────────────────────────────────
    if (action === "evaluate") {
      const r = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `A student learning ${learnLang} (native language: ${nativeLang}) was asked to translate:
"${word}"

Correct answer: "${correctAnswer}"
Student's answer: "${userAnswer}"

Return ONLY valid JSON, no markdown:
{
  "correct": true or false,
  "score": 0-100,
  "feedback": "1-2 sentences in ${nativeLang}: praise if correct, or gently explain the mistake and give a helpful grammar/usage tip"
}

Be generous: accept synonyms, minor spelling errors, and natural variations as correct (score 80+).
Only mark wrong if the meaning is clearly different.`
        }]
      });

      let raw = r.content[0].text.trim()
        .replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/,"").trim();
      return res.json(JSON.parse(raw));
    }

    // ── Explain: deeper explanation for a word ─────────────────────────
    if (action === "explain") {
      const r = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Explain the ${learnLang} word "${word}" (meaning: "${correctAnswer}") to a ${nativeLang} speaker.

Return ONLY valid JSON, no markdown:
{
  "grammar_note": "brief grammar rule or pattern in ${nativeLang} (e.g. when to use this word vs a similar one)",
  "more_examples": ["example 1 in ${learnLang}", "example 2 in ${learnLang}"],
  "more_examples_translated": ["example 1 in ${nativeLang}", "example 2 in ${nativeLang}"],
  "common_mistake": "the most common mistake ${nativeLang} speakers make with this word, in ${nativeLang}"
}`
        }]
      });

      let raw = r.content[0].text.trim()
        .replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/,"").trim();
      return res.json(JSON.parse(raw));
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
