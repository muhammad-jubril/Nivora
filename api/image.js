const { checkRateLimit } = require("./_rateLimit");

const RATE_LIMIT = 4; // requests
// Pollinations' free anonymous tier is itself limited to roughly one
// request every 15 seconds, so we keep our own per-visitor limit modest
// too — this protects fairness across visitors sharing that shared pool.
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP

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

    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt.trim()
    )}?width=1024&height=1024&seed=${seed}&nologo=true`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Something went wrong. Please try again.",
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");

    res.status(200).json({ b64 });
  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
