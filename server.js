const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Streaming translation endpoint
app.post("/translate", async (req, res) => {
  const { text, direction } = req.body;

  if (!text || !text.trim()) {
    return res.json({ translation: "" });
  }

  const isEnToEs = direction === "en-es";
  const sourceLang = isEnToEs ? "English" : "Spanish";
  const targetLang = isEnToEs ? "Spanish" : "English";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You are Alazab Translator, a precise and natural language translator.
Your ONLY job is to translate from ${sourceLang} to ${targetLang}.

Rules:
- Output ONLY the translation. No explanations, no notes, no alternatives.
- Preserve the original tone, formality, and meaning.
- Handle slang, idioms, and colloquialisms naturally.
- If the input is already in ${targetLang}, translate it back to ${sourceLang}.
- For single words, provide the most common translation.
- Preserve punctuation and formatting.`,
      messages: [
        {
          role: "user",
          content: `Translate this ${sourceLang} text to ${targetLang}:\n\n${text}`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ chunk: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Translation error:", err.message);
    res.write(
      `data: ${JSON.stringify({ error: "Translation failed. Check your API key." })}\n\n`
    );
    res.end();
  }
});

// Language detection endpoint
app.post("/detect", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.json({ lang: "en" });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 10,
      system:
        'Detect the language of the text. Reply with ONLY "en" for English or "es" for Spanish.',
      messages: [{ role: "user", content: text }],
    });
    const lang =
      response.content[0]?.text?.trim().toLowerCase().startsWith("es")
        ? "es"
        : "en";
    res.json({ lang });
  } catch {
    res.json({ lang: "en" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌐 Alazab Translator running at http://localhost:${PORT}\n`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠️  ANTHROPIC_API_KEY not set. Set it before translating.\n"
    );
  }
});
