/* Shared by every page: the status-line clock, copy buttons, and the
   redirect from the old single-page anchors to their own URLs. */
(() => {
  "use strict";

  /* ---------- status line clock (Stockholm) ---------- */
  const clock = document.querySelector("#clock");
  if (clock) {
    const tick = () => {
      clock.textContent = new Intl.DateTimeFormat("sv-SE", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm"
      }).format(new Date());
    };
    tick();
    setInterval(tick, 10000);
  }

  /* ---------- copy buttons ---------- */
  for (const btn of document.querySelectorAll(".copy")) {
    btn.addEventListener("click", async () => {
      const src = document.getElementById(btn.dataset.copy);
      if (!src) return;
      let ok = true;
      try {
        await navigator.clipboard.writeText(src.textContent);
      } catch (e) {
        ok = false; // insecure context, denied permission, or no clipboard API
      }
      btn.textContent = ok ? "copied" : "select and copy";
      btn.classList.toggle("copy-done", ok);
      setTimeout(() => {
        btn.textContent = "copy";
        btn.classList.remove("copy-done");
      }, 2000);
    });
  }

  /* ---------- page views ----------
     Counts the view and fills in whichever of the three spans this page shows.
     The endpoint keeps running totals per country; nothing about a visit is
     stored, and the browser sends nothing it would not send anyway. */
  const lineEl = document.querySelector("#hits-line");
  const topEl = document.querySelector("#hits-top");
  const plural = (n, one, many) => n.toLocaleString("en-GB") + " " + (n === 1 ? one : many);

  const country = (cc) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc;
    } catch (e) {
      return cc; // unknown code, or a browser without DisplayNames
    }
  };

  if (typeof fetch === "function") fetch("/api/hits", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || typeof d.total !== "number") return;
      if (lineEl) {
        lineEl.textContent = plural(d.total, "page view", "page views") +
          " from " + plural(d.countries, "country", "countries");
      }
      if (topEl && d.top && d.top.length) {
        topEl.textContent = d.top
          .map((c) => country(c.cc) + " " + c.n.toLocaleString("en-GB"))
          .join(" · ");
      }
    })
    .catch(() => { /* a counter is not worth breaking a page over */ });

  /* ---------- the articles used to live on the CV as #anchors ---------- */
  const moved = { "#build": "/build", "#onwards": "/onwards", "#yours": "/yours",
                  "#timeline": "/build", "#colophon": "/build",
                  "#phone": "/onwards", "#recipe": "/yours" };
  if (location.pathname === "/" && moved[location.hash]) {
    location.replace(moved[location.hash]);
  }
})();
