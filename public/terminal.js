(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);

  /* ---------- status line clock (Stockholm) ---------- */
  const clock = $("#clock");
  const tick = () => {
    clock.textContent = new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm"
    }).format(new Date());
  };
  tick();
  setInterval(tick, 10000);

  /* ---------- email: assembled client-side, never in the markup ---------- */
  const mail = $("#mail");
  const address = mail.dataset.u + "@" + mail.dataset.d;
  mail.href = "mailto:" + address;
  mail.textContent = address;

  /* ---------- hero: one orchestrated moment ---------- */
  const hero = document.querySelector(".hero");
  const typed = document.querySelector(".typed");
  if (reduced) {
    hero.classList.add("done");
  } else {
    const text = typed.dataset.typed;
    typed.textContent = "";
    let i = 0;
    const step = () => {
      typed.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 38 + Math.random() * 45);
      else setTimeout(() => hero.classList.add("done"), 700);
    };
    setTimeout(step, 350);
  }

  /* ---------- shell ---------- */
  const form = $("#shell");
  const input = $("#cmdline");
  const out = $("#shellout");
  const history = [];
  let hpos = 0;

  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  const print = (text, cls) => {
    const p = document.createElement("p");
    if (cls) p.className = cls;
    p.innerHTML = text;
    out.appendChild(p);
    while (out.children.length > 60) out.removeChild(out.firstChild);
    out.classList.add("open");
    out.scrollTop = out.scrollHeight;
  };

  const go = (sel, label) => {
    const el = document.querySelector(sel);
    if (!el) return print("not found: " + esc(sel), "err");
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    print(label);
  };

  const setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch (e) { /* private mode */ }
  };

  const sections = {
    summary:    ["#doc",         "jumped to the top"],
    skills:     ["#skills",      "skills.txt"],
    experience: ["#experience",  "uptime --history"],
    projects:   ["#projects",    "~/projects"],
    certs:      ["#about",       "certs.txt"],
    languages:  ["#about",       "languages.txt"],
    contact:    ["#contact",     "contact --list"]
  };

  const projects = {
    bastion:   "#bastion",
    icinga:    "#icinga-monolith",
    secrets:   "#secrets",
    dexcom:    "#dexcom",
    insider:   "#insider"
  };

  const commands = {
    help() {
      print("<b>available commands</b>");
      print("  ls                 list sections");
      print("  cat &lt;section&gt;      jump to a section");
      print("  open &lt;project&gt;     jump to a project (" + Object.keys(projects).join(", ") + ")");
      print("  whoami             the short version");
      print("  uptime             years in the field");
      print("  pdf                download the CV");
      print("  github, linkedin, email");
      print("  theme [dark|light] switch the palette");
      print("  clear              clear this output");
      print("  exit               close this pane");
    },
    ls() { print(Object.keys(sections).join("  ")); },
    cat(arg) {
      if (!arg) return print("cat: missing operand — try <b>ls</b>", "err");
      const s = sections[arg.replace(/\.txt$/, "")];
      if (!s) return print("cat: " + esc(arg) + ": no such section", "err");
      go(s[0], s[1]);
    },
    cd(arg) { commands.cat(arg || "summary"); },
    open(arg) {
      if (!arg) return print("open: which one? " + Object.keys(projects).join(", "), "err");
      const p = projects[arg];
      if (!p) return print("open: " + esc(arg) + ": no such project", "err");
      go(p, "~/projects/" + arg);
    },
    whoami() {
      print("Erik Linde — IT operations &amp; monitoring engineer, Stockholm.");
      print("Six years in IT ops. Currently observability for ~6,000 Ubuntu hosts");
      print("across seven European markets. I build the tooling I need.");
    },
    uptime() {
      const start = new Date("2016-01-01");
      const months = Math.floor((Date.now() - start) / 2629800000);
      print("up " + Math.floor(months / 12) + "y " + (months % 12) + "m, 4 roles, 0 unplanned career outages");
    },
    pdf() { print("fetching erik-linde-cv.pdf"); window.location.href = "/erik-linde-cv.pdf"; },
    github() { print("opening github.com/1eriklinde"); window.open("https://github.com/1eriklinde", "_blank", "noopener"); },
    linkedin() { print("opening linkedin"); window.open("https://linkedin.com/in/erik-linde-106885270", "_blank", "noopener"); },
    email() { print("opening mail client — " + address); window.location.href = "mailto:" + address; },
    theme(arg) {
      const next = arg === "light" || arg === "dark"
        ? arg
        : (document.documentElement.dataset.theme === "light" ? "dark" : "light");
      setTheme(next);
      print("theme set to " + next);
    },
    clear() { out.innerHTML = ""; },
    exit() { out.innerHTML = ""; out.classList.remove("open"); input.blur(); },
    sudo() { print("erik is not in the sudoers file. This incident has been reported.", "err"); }
  };

  const aliases = { man: "help", "?": "help", dir: "ls", quit: "exit", q: "exit", mail: "email", cv: "pdf", resume: "pdf", contact: "cat contact", skills: "cat skills", experience: "cat experience", projects: "cat projects", work: "cat experience", top: "cat summary" };

  const run = (raw) => {
    const line = raw.trim();
    if (!line) return;
    print('<span class="prompt">$</span> <span class="echo">' + esc(line) + "</span>");
    const expanded = aliases[line.toLowerCase()] || line;
    const [cmd, ...rest] = expanded.split(/\s+/);
    const fn = commands[cmd.toLowerCase()];
    if (!fn) return print(esc(cmd) + ": command not found — try <b>help</b>", "err");
    fn(rest.join(" ").toLowerCase());
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    if (v.trim()) { history.push(v); hpos = history.length; }
    run(v);
    input.value = "";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hpos > 0) input.value = history[--hpos];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hpos < history.length - 1) input.value = history[++hpos];
      else { hpos = history.length; input.value = ""; }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const parts = input.value.split(/\s+/);
      const pool = parts.length > 1
        ? (parts[0] === "open" ? Object.keys(projects) : Object.keys(sections))
        : Object.keys(commands).concat(Object.keys(aliases));
      const frag = parts[parts.length - 1].toLowerCase();
      const hits = pool.filter((c) => c.startsWith(frag));
      if (hits.length === 1) {
        parts[parts.length - 1] = hits[0];
        input.value = parts.join(" ");
      } else if (hits.length > 1) {
        let prefix = hits[0];
        for (const h of hits) {
          while (!h.startsWith(prefix)) prefix = prefix.slice(0, -1);
        }
        if (prefix.length > frag.length) {
          parts[parts.length - 1] = prefix;
          input.value = parts.join(" ");
        }
        print(hits.join("  "));
      }
    } else if (e.key === "Escape") {
      input.value = "";
      commands.exit();
    }
  });

  /* ---------- copy buttons ---------- */
  for (const btn of document.querySelectorAll(".copy")) {
    btn.addEventListener("click", async () => {
      const src = document.getElementById(btn.dataset.copy);
      if (!src) return;
      const text = src.textContent;
      let ok = true;
      try {
        await navigator.clipboard.writeText(text);
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

  /* "/" from anywhere focuses the prompt, like a real console */
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
  });

})();
