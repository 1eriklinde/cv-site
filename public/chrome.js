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

  /* ---------- the articles used to live on the CV as #anchors ---------- */
  const moved = { "#build": "/build", "#onwards": "/onwards", "#yours": "/yours",
                  "#timeline": "/build", "#colophon": "/build",
                  "#phone": "/onwards", "#recipe": "/yours" };
  if (location.pathname === "/" && moved[location.hash]) {
    location.replace(moved[location.hash]);
  }
})();
