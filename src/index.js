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

const BUMP =
  "INSERT INTO hits (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1";

async function hits(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  try {
    if (request.method === "POST") {
      // Cloudflare resolves the country at the edge. We keep a running total
      // per country and never write a row for an individual visit, so there is
      // no record here that a particular request ever happened.
      const cc = (request.cf && request.cf.country) || "XX";
      const key = /^[A-Z]{2}$/.test(cc) ? `cc:${cc}` : "cc:XX";
      await env.DB.batch([
        env.DB.prepare(BUMP).bind("total"),
        env.DB.prepare(BUMP).bind(key)
      ]);
    }
    const detail = new URL(request.url).searchParams.get("detail") === "1";
    return json(await summary(env, detail));
  } catch (e) {
    // A counter is not worth a 500 on the page it decorates — but swallowing the
    // reason cost an hour once, so it goes to the log where `wrangler tail` sees it.
    console.error("hits:", e && e.stack ? e.stack : String(e));
    return json({ total: null, error: "counter unavailable" }, 503);
  }
}

async function summary(env, detail) {
  const total = await env.DB.prepare("SELECT n FROM hits WHERE k = 'total'").first();
  const rows = await env.DB.prepare(
    "SELECT k, n FROM hits WHERE k LIKE 'cc:%' ORDER BY n DESC"
  ).all();
  const countries = (rows.results || []).map((r) => ({ cc: r.k.slice(3), n: r.n }));
  const out = {
    total: total ? total.n : 0,
    countries: countries.length,
    top: countries.slice(0, 5)
  };
  // /stats asks for the whole list; every other page load does not need it
  if (detail) out.all = countries;
  return out;
}
