import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers });

  const store = getStore("wise-signals");

  if (req.method === "POST") {
    const body = await req.text();
    await store.set("latest", body);
    return new Response(JSON.stringify({ ok: true, updated: new Date().toISOString() }), { headers });
  }

  const data = await store.get("latest");
  return new Response(data || "[]", { headers });
};

export const config = { path: "/api/signals" };
