# Nova — Powered by MJ

A branded AI assistant: chat + image generation, built on Google's Gemini API
(both chat and images, using the free tier), wrapped in your own product and
UI. Users never see "Gemini," "Google," or any other AI lab — Nova always
identifies itself as created by MJ.

## What's inside

```
nova/
├── api/             Serverless functions — hold your API key, talk to Gemini
│   ├── chat.js
│   └── image.js
├── index.html       Nova's interface
├── css/style.css
├── js/script.js
└── package.json
```

The frontend never calls Gemini directly — it only ever talks to `/api/chat`
and `/api/image` on your own domain, which hold the real API key
server-side. Never put API keys in frontend code — anyone could steal them.

## Getting your API key (free, no credit card)

1. Go to **https://aistudio.google.com** and sign in with a Google account
2. Click **"Get API key"** (usually top-left or under a key icon)
3. Click **"Create API key"**
4. Copy it — this one key works for both chat and images

That's it — no billing setup required for the free tier this project uses.

**Free tier limits** (as of when this was written — Google can change these):
- Chat (`gemini-2.5-flash`): generous daily request limits, no card
- Images (`gemini-2.5-flash-image`, aka "Nano Banana"): up to ~500 images/day,
  no card

If you ever outgrow these limits, Google's paid tier is also usage-based
(pay only for what you use above free quota) — but for a portfolio project
or moderate traffic, the free tier should comfortably cover you.

One thing worth knowing: on the free tier, Google may use your prompts to
improve their models (this is disclosed in their terms). Their paid tier
turns this off. Worth keeping in mind if you or users ever put sensitive
info into Nova.

## Running it locally (before deploying)

1. Install Node.js (v18+): https://nodejs.org
2. Install the Vercel CLI: `npm install -g vercel`
3. From the project folder, run: `vercel dev`
4. Add a `.env` file in the project root with:
   ```
   GEMINI_API_KEY=your_key_here
   ```
5. Open the local URL it gives you (usually http://localhost:3000)

## Deploying: GitHub → Vercel, step by step

**1. Push the project to GitHub**
   - Create a new repository on https://github.com/new (keep it private if
     you're not ready for the public to see the code)
   - In the project folder, run:
     ```
     git init
     git add .
     git commit -m "Nova, powered by MJ"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     git push -u origin main
     ```

**2. Import the project into Vercel**
   - Go to https://vercel.com and sign in (you can sign in with your GitHub
     account directly)
   - Click "Add New" → "Project"
   - Select the GitHub repository you just pushed
   - Vercel will auto-detect it as a Node project — you don't need to change
     any build settings

**3. Add your API key before deploying**
   - In the import screen (or later under Project → Settings →
     Environment Variables), add:
     - `GEMINI_API_KEY` → your Gemini key from AI Studio
   - Make sure it's added for "Production" (and "Preview" if you want
     preview deployments to work too)

**4. Deploy**
   - Click "Deploy"
   - Vercel gives you a live URL like `nova-powered-by-mj.vercel.app` — that's
     it, it's live

**5. Future updates**
   - Any time you push new commits to the `main` branch on GitHub, Vercel
     automatically redeploys — no manual steps needed after the first setup

**6. Optional: custom domain**
   - Under Project → Settings → Domains, you can attach your own domain
     (e.g. `nova.yourname.com`) instead of the vercel.app one

## Rate limiting

Both `/api/chat` and `/api/image` limit each visitor (by IP) to:
- **Chat:** 15 messages per minute
- **Images:** 6 generations per minute

This isn't just about cost now — it also protects your free daily quota from
being burned through by one heavy user or a bot, so the app keeps working for
everyone else. Honest caveat: this uses in-memory counting per serverless
instance, so it's not perfectly precise under heavy simultaneous traffic, but
it stops realistic abuse for a portfolio-scale project. You can adjust the
numbers at the top of `api/chat.js` and `api/image.js`.

## How the "Nova, by MJ" identity works

Every request to `/api/chat` sends a system instruction telling Gemini to
behave as "Nova," created by MJ, and never reveal the underlying model or
company. This is normal — most AI-powered products work this way under the
hood.

## Customizing

- **Colors/branding:** edit the CSS variables at the top of `css/style.css`
  (there's a light theme and dark theme block)
- **Nova's personality/behavior:** edit `NOVA_SYSTEM_PROMPT` in `api/chat.js`
- **WhatsApp bug report number:** `WHATSAPP_NUMBER` in `js/script.js`

## Next steps (not included yet)

- User accounts + saved chat history (e.g. via Supabase or Firebase)
- Custom domain (see step 6 above)
- If this ever needs a paid, higher tier: swap in Anthropic or OpenAI later
  the same way this was swapped to Gemini — the `/api` structure stays the
  same either way
