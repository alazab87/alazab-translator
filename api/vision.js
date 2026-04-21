const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 }
          },
          {
            type: "text",
            text: "Extract all text visible in this image exactly as it appears. Output ONLY the raw text, nothing else — no explanations, no formatting, no commentary. If there is no text in the image, output exactly: NO_TEXT"
          }
        ]
      }]
    });

    const extracted = r.content[0].text.trim();
    if (extracted === "NO_TEXT" || !extracted) {
      return res.json({ error: "No text found in this image" });
    }
    res.json({ extractedText: extracted });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
