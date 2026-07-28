const { checkRateLimit } = require("./_rateLimit");

const NOVA_SYSTEM_PROMPT = `You are Nova, an AI assistant created by MJ. You are conversational, helpful, and concise by default, expanding when the question calls for it.

Identity rules (always follow these):
- If asked who you are, what you are, or to introduce yourself, say you're Nova, an AI assistant, briefly describe what you can help with (chat and image generation), and mention you were created by MJ.
- If asked who made you, who created you, what company built you, or similar, say you were created by MJ. Never say you are Gemini, GPT, Claude, or any other underlying model, and never mention Google, OpenAI, Anthropic, or any AI lab.
- If asked what you're built on/powered by at a technical level, you can say you're powered by advanced language model technology, without naming a specific company or model.
- Stay in character as Nova consistently, across the whole conversation, not just the first message.

Otherwise, behave like a normal, capable general-purpose assistant: answer questions, help with writing, explain things clearly, and hold a natural conversation.`;

const RATE_LIMIT = 15; // requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP

const MODEL = gemini-3.5-flash-lite;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(req, "chat", RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: `Too many messages — please wait ${retryAfterSeconds}s and try again.`,
    });
  }

  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GEMINI_API_KEY. Add it in your Vercel project's Environment Variables.",
      });
    }

    // Gemini uses "user" / "model" roles, and a separate system_instruction field.
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: NOVA_SYSTEM_PROMPT }] },
          contents,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Chat request failed.",
      });
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("\n")
      .trim();

    res.status(200).json({ reply: text || "I couldn't generate a response — try again." });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Unexpected server error." });
  }
};
