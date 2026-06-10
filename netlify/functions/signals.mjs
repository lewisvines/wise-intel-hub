import { getStore } from "@netlify/blobs";

// The front end normally reads signals straight from this committed file
// (the daily GitHub Action scanner writes it). We use it as a fallback so a
// GET to /api/signals always returns real data even if the blob is empty.
const FALLBACK_URL =
  "https://raw.githubusercontent.com/lewisvines/wise-intel-hub/main/signals.json";

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: baseHeaders,
  });

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  // Open the blob store defensively. If Netlify Blobs isn't configured on the
  // site, getStore can throw -- never let that become an unhandled 500.
  let store = null;
  try {
    store = getStore("wise-signals");
  } catch {
    store = null;
  }

  if (req.method === "POST") {
    if (!store) return json({ ok: false, error: "Blob store unavailable" }, 503);
    try {
      const body = await req.text();
      await store.set("latest", body);
      return json({ ok: true, updated: new Date().toISOString() });
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) }, 500);
    }
  }

  if (req.method !== "GET") return json({ error: "Use GET or POST" }, 405);

  // GET: prefer the blob value, then the committed signals.json, then [] --
  // but always respond 200 with valid JSON.
  if (store) {
    try {
      const data = await store.get("latest");
      if (data && data.trim() && data.trim() !== "[]") return json(data);
    } catch {
      /* fall through to the committed file */
    }
  }

  try {
    const r = await fetch(FALLBACK_URL + "?v=" + Date.now());
    if (r.ok) {
      const text = await r.text();
      if (text && text.trim()) return json(text);
    }
  } catch {
    /* fall through to empty */
  }

  return json("[]");
};

export const config = { path: "/api/signals" };
