const Anthropic = require("@anthropic-ai/sdk");
const { checkLimit, visionLimiter } = require("./_ratelimit");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const limited = await checkLimit(visionLimiter, req);
  if (limited) return res.status(429).json(limited);

  const { imageBase64, mediaType, tgtLang } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 }
          },
          {
            type: "text",
            text: `Detect every text region in this image and translate each one to ${tgtLang}.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "original": "exact text as it appears in the image",
    "translation": "translated text in ${tgtLang}",
    "x": 12,
    "y": 8,
    "w": 45,
    "h": 6
  }
]

x = left edge as % of image width (0–100)
y = top edge as % of image height (0–100)
w = region width as % of image width (0–100)
h = region height as % of image height (0–100)

Include every visible text block. If the image has no text at all, return: []`
          }
        ]
      }]
    });

    let raw = r.content[0].text.trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    const regions = JSON.parse(raw);
    res.json({ regions: Array.isArray(regions) ? regions : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
