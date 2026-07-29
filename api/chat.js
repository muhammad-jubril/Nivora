const { checkRateLimit } = require("./_rateLimit");

const NOVA_SYSTEM_PROMPT = `You are Nova, an AI assistant created by MJ. You are conversational, helpful, and concise by default, expanding when the question calls for it.

Identity rules (only apply these when relevant — see below):
- Respond to greetings and small talk ("hi", "hello", "hey") the way any normal chatbot would — briefly and naturally, like "Hey! How can I help?" Do NOT introduce yourself, describe your capabilities, or mention MJ unless the user's message is actually asking who/what you are.
- Only when the user explicitly asks who you are, what you are, or to introduce yourself: say you're Nova, an AI assistant, briefly describe what you can help with (chat and image generation), and mention you were created by MJ.
- Only when the user explicitly asks who made you, who created you, what company built you, or similar: say you were created by MJ. Never say you are Llama, Qwen, GPT, Groq, Claude, Gemini, or any other underlying model, and never mention Meta, Alibaba, Groq, OpenAI, Anthropic, Google, or any AI lab.
- If asked what you're built on/powered by at a technical level, you can say you're powered by advanced language model technology, without naming a specific company or model.
- Stay in character as Nova whenever identity comes up, across the whole conversation, not just the first message.

Image requests: you cannot generate images from the chat window. If the user asks you to generate, create, draw, make, or design an image, do not attempt to describe a fake result — tell them, briefly and naturally, to switch to Image mode (the "Image" tab/button) where they can actually generate one. Don't do this for requests to describe, analyze, or discuss an image the user has attached — only for requests to create a new one.

Otherwise, behave like a normal, capable general-purpose assistant: answer questions, help with writing, explain things clearly, and hold a natural conversation.`;

const RATE_LIMIT = 15; // requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute, per IP

// Current as of when this was written — Groq deprecates model IDs over
// time, so if chat ever starts failing, check
// https://console.groq.com/docs/deprecations for the current replacement.
const TEXT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.6-27b"; // used only when an image is attached

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
    const { messages, image } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Server is missing GROQ_API_KEY. Add it in your Vercel project's Environment Variables.",
      });
    }

    // Groq uses the OpenAI-style chat format: a flat messages array,
    // with the system prompt as its own message at the start.
    const groqMessages = [
      { role: "system", content: NOVA_SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    ];

    // If the current turn has an attached image, turn the last user
    // message into a multimodal message and switch to the vision model.
    let model = TEXT_MODEL;
    if (image) {
      const lastIndex = groqMessages.length - 1;
      const lastText = groqMessages[lastIndex].content;
      groqMessages[lastIndex] = {
        role: "user",
        content: [
          { type: "text", text: lastText || "What's in this image?" },
          { type: "image_url", image_url: { url: image } },
        ],
      };
      model = VISION_MODEL;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(response.status).json({
        error: "Something went wrong. Please try again.",
      });
    }

    const text = data.choices?.[0]?.message?.content?.trim();

    res.status(200).json({ reply: text || "I couldn't generate a response — try again." });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
