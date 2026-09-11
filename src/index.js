// The site is static assets; this Worker exists for one endpoint.
//
// Requests that match a file in public/ are served straight from the edge and
// never reach this code — Cloudflare documents those as free and unlimited.
// Only /api/hits invokes the Worker, so a page view still costs nothing.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/hits") return hits(request, env);
    return env.ASSETS.fetch(request);
  }
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

async function hits(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  try {
    if (request.method === "POST") {
      // One statement: insert the counter or bump it, and hand back the new value.
      const row = await env.DB.prepare(
        "INSERT INTO hits (k, n) VALUES ('total', 1) " +
        "ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n"
      ).first();
      return json({ total: row.n });
    }
    const row = await env.DB.prepare("SELECT n FROM hits WHERE k = 'total'").first();
    return json({ total: row ? row.n : 0 });
  } catch (e) {
    // A counter is not worth a 500 on the page it decorates.
    return json({ total: null, error: "counter unavailable" }, 503);
  }
}
