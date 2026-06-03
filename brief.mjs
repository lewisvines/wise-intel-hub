// netlify/functions/brief.mjs
// Server-side proxy for the WiSE Weekly Brief generator.
// Holds the Anthropic key in an env var so it is NEVER exposed in the browser.
//
// Setup (one-off, done by you in Netlify - never shared with anyone):
//   Site settings > Environment variables > add  ANTHROPIC_API_KEY = sk-ant-...
// Then set WISE_BRIEF_API in src/index.html to:  https://<your-site>.netlify.app/api/brief

export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",            // hub is served from GitHub Pages (different origin)
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set in Netlify env" }), { status: 500, headers });
  }

  let prompt = "";
  try {
    ({ prompt } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Body must be JSON { prompt }" }), { status: 400, headers });
  }
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing 'prompt'" }), { status: 400, headers });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        // Update this model string if you want a newer model.
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || "Anthropic API error", status: r.status }), { status: r.status, headers });
    }
    const text = data?.content?.[0]?.text || "";
    return new Response(JSON.stringify({ text }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers });
  }
};

export const config = { path: "/api/brief" };
