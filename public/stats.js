/* The views-by-country chart on /stats.
   Hand-rolled SVG: no chart library, no third-party request, and every colour
   comes from the stylesheet so the theme switch and the CSP both keep working. */
(() => {
  "use strict";

  const root = document.querySelector("#chart");
  if (!root) return;

  const num = (n) => n.toLocaleString("en-GB");
  const name = (cc) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc;
    } catch (e) {
      return cc;
    }
  };

  const el = (tag, attrs, text) => {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // A bar with a rounded data-end and a square baseline, per the mark spec.
  const barPath = (x, y, w, h, r) => {
    if (w <= r) return `M${x} ${y}h${w}v${h}h${-w}z`;
    return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}` +
           `a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r)}z`;
  };

  const say = (msg) => {
    root.textContent = "";
    const p = document.createElement("p");
    p.className = "chart-empty";
    p.textContent = msg;
    root.appendChild(p);
  };

  const statTile = (total, only) => {
    root.textContent = "";
    const wrap = document.createElement("p");
    wrap.className = "stat-tile";
    const big = document.createElement("span");
    big.className = "stat-figure";
    big.textContent = num(total);
    wrap.appendChild(big);
    const rest = document.createElement("span");
    rest.className = "stat-note";
    rest.textContent = total === 1 ? " view, from " + only : " views, all from " + only;
    wrap.appendChild(rest);
    root.appendChild(wrap);
  };

  const table = (rows, total) => {
    const t = document.createElement("table");
    t.className = "stats-table";
    const head = document.createElement("thead");
    head.innerHTML = "<tr><th>Country</th><th>Views</th><th>Share</th></tr>";
    t.appendChild(head);
    const body = document.createElement("tbody");
    for (const r of rows) {
      const tr = document.createElement("tr");
      const share = total ? Math.round((r.n / total) * 100) : 0;
      for (const v of [name(r.cc), num(r.n), share + "%"]) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    t.appendChild(body);
    return t;
  };

  const chart = (rows) => {
    const SHOWN = 12;
    const shown = rows.slice(0, SHOWN);
    const W = 720, GUTTER = 150, PAD_RIGHT = 64;
    const BAND = 30, BAR = 18, R = 4;
    const plot = W - GUTTER - PAD_RIGHT;
    const H = shown.length * BAND + 8;
    const max = Math.max(...shown.map((r) => r.n));

    const svg = el("svg", {
      viewBox: `0 0 ${W} ${H}`, class: "chart-svg",
      role: "img", "aria-label": "Page views by country, highest first."
    });

    shown.forEach((r, i) => {
      const y = i * BAND;
      const w = Math.max(2, Math.round((r.n / max) * plot));
      const g = el("g", { class: "bar-row" });
      g.appendChild(el("title", {}, `${name(r.cc)}: ${num(r.n)}`));
      g.appendChild(el("text", {
        x: GUTTER - 10, y: y + BAR / 2 + 1, class: "bar-label",
        "text-anchor": "end", "dominant-baseline": "middle"
      }, name(r.cc)));
      g.appendChild(el("path", { d: barPath(GUTTER, y, w, BAR, R), class: "bar" }));
      g.appendChild(el("text", {
        x: GUTTER + w + 8, y: y + BAR / 2 + 1, class: "bar-value",
        "dominant-baseline": "middle"
      }, num(r.n)));
      svg.appendChild(g);
    });

    // one hairline baseline; no gridlines — the values are labelled
    svg.appendChild(el("line", {
      x1: GUTTER, y1: 0, x2: GUTTER, y2: shown.length * BAND - (BAND - BAR),
      class: "chart-axis"
    }));
    return { svg, hidden: rows.length - shown.length };
  };

  fetch("/api/hits?detail=1")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !Array.isArray(d.all)) return say("The counter is unavailable right now.");
      const rows = d.all.filter((r) => r.n > 0);
      if (!rows.length || !d.total) return say("No views recorded yet.");
      // A single category is a number, not a chart.
      if (rows.length === 1) return statTile(d.total, name(rows[0].cc));

      root.textContent = "";
      const { svg, hidden } = chart(rows);
      root.appendChild(svg);
      if (hidden > 0) {
        const p = document.createElement("p");
        p.className = "chart-note";
        p.textContent = hidden === 1
          ? "One more country, in the table below."
          : hidden + " more countries, in the table below.";
        root.appendChild(p);
      }
      root.appendChild(table(rows, d.total));
    })
    .catch(() => say("The counter is unavailable right now."));
})();
