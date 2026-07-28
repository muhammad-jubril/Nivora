const { checkRateLimit } = require("./_rateLimit");

const RATE_LIMIT = 6; // requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP

const MODEL = "gemini-3.5-flash-image";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(req, "image", RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: `Too many image requests — please wait ${retryAfterSeconds}s and try again.`,
    });
  }

  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GEMINI_API_KEY. Add it in your Vercel project's Environment Variables.",
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt.trim() }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini image API error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Image request failed.",
      });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart) {
      return res.status(500).json({ error: "No image was returned — try rephrasing your prompt." });
    }

    res.status(200).json({ b64: imagePart.inlineData.data });
  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: "Unexpected server error." });
  }
};
