export default async (req, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers });

  // Use Netlify KV / environment-based storage
  // Store in a global variable (persists per function instance)
  if (req.method === "POST") {
    const body = await req.text();
    // Write to a file in /tmp (Netlify functions have /tmp access)
    const { writeFileSync } = await import('fs');
    writeFileSync('/tmp/signals.json', body);
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  // GET - return stored signals
  try {
    const { readFileSync } = await import('fs');
    const data = readFileSync('/tmp/signals.json', 'utf8');
    return new Response(data, { headers });
  } catch (e) {
    return new Response('[]', { headers });
  }
};

export const config = { path: "/api/signals" };
