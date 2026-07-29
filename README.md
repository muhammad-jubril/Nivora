# Nivora — Built by MJ

A branded AI assistant: chat + image generation, built on **Groq** (chat) and
**Pollinations.ai** (images) — both genuinely free, no credit card, ever.
Wrapped in your own product and UI. Users never see "Groq," "Llama,"
"Pollinations," or any other AI lab — Nivora always identifies itself as
created by MJ.

## What's inside
## Getting your API key (Groq — free, no card, ever)

1. Go to **https://console.groq.com** and sign up with an email
2. Click **"API Keys"** in the sidebar
3. Click **"Create API Key"**, name it, copy it — starts with `gsk_...`

That's the only key you need. **Image generation needs no key at all** — it
uses Pollinations.ai, which is open with no signup.

**Free tier limits** (as of when this was written):
- Chat (Groq, Llama 3.3 70B): ~14,400 requests/day, 30/minute — very generous
- Images (Pollinations): shared anonymous access, roughly 1 request per 15
  seconds across all anonymous users — this is the one soft spot; if it ever
  feels slow, Pollinations also offers a free registered tier with higher
  limits (still no payment) — see pollinations.ai

## Running it locally (before deploying)

1. Install Node.js (v18+): https://nodejs.org
2. Install the Vercel CLI: `npm install -g vercel`
3. From the project folder, run: `vercel dev`
4. Add a `.env` file in the project root with:
5. Open the local URL it gives you (usually http://localhost:3000)

## Deploying: GitHub → Vercel, step by step

**1. Push the project to GitHub**
- Create a new repository on https://github.com/new
- Push this project's files to it (via `git`, or by hand through GitHub's
  web "Create new file" if you're on mobile)

**2. Import the project into Vercel**
- Go to https://vercel.com, sign in with GitHub
- Click "Add New" → "Project" → select your repo → "Import"

**3. Add your API key before deploying**
- Under "Environment Variables," add:
  - `GROQ_API_KEY` → your Groq key
- Make sure it's added for "Production"

**4. Deploy**
- Click "Deploy" — you'll get a live link like `nivora-ai.vercel.app`

**5. Future updates**
- Any push to `main` on GitHub automatically redeploys

## Rate limiting

Both `/api/chat` and `/api/image` limit each visitor (by IP) to:
- **Chat:** 15 messages per minute
- **Images:** 4 generations per minute (kept modest since Pollinations'
free anonymous tier is itself shared and rate-limited)

This protects your free daily quota from being burned through by one heavy
user or a bot. Honest caveat: this uses in-memory counting per serverless
instance, so it's not perfectly precise under heavy simultaneous traffic,
but it stops realistic abuse for a portfolio-scale project. Adjust the
numbers at the top of `api/chat.js` and `api/image.js`.

## How the "Nivora, by MJ" identity works

Every request to `/api/chat` sends a system prompt telling the model to
behave as "Nivora," created by MJ, describe itself when asked "who are you,"
and never reveal the underlying model or company. This is normal — most
AI-powered products work this way under the hood.

## Customizing

- **Colors/branding:** CSS variables at the top of `css/style.css` (light +
dark theme blocks)
- **Nivora's personality/behavior:** `NIVORA_SYSTEM_PROMPT` in `api/chat.js`
- **WhatsApp bug report number:** `WHATSAPP_NUMBER` in `js/script.js`
- **Image style/size:** adjust the query params in `api/image.js`

## Next steps (not included yet)

- User accounts + saved chat history (e.g. via Supabase or Firebase)
- Custom domain (Vercel → Project → Settings → Domains)
- If this ever needs a higher, paid tier: swap in another provider later —
the `/api` structure stays the same either way
