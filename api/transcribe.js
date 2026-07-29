const { checkRateLimit } = require("./_rateLimit");

const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(req, "transcribe", RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: `Too many voice notes — please wait ${retryAfterSeconds}s and try again.`,
    });
  }

  try {
    const { audio } = req.body; // base64 data URL, e.g. "data:audio/webm;base64,...."
    if (!audio || !audio.startsWith("data:")) {
      return res.status(400).json({ error: "audio (base64 data URL) is required" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GROQ_API_KEY. Add it in your Vercel project's Environment Variables.",
      });
    }

    const [, base64] = audio.split(",");
    const buffer = Buffer.from(base64, "base64");

    const form = new FormData();
    form.append("file", new Blob([buffer]), "voice-note.webm");
    form.append("model", "whisper-large-v3-turbo");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: form,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq transcription error:", data);
      return res.status(response.status).json({
        error: "Something went wrong. Please try again.",
      });
    }

    res.status(200).json({ text: (data.text || "").trim() });
  } catch (err) {
    console.error("Transcribe error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
