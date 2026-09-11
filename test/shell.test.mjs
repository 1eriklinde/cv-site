import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public") + path.sep;
const html = fs.readFileSync(root + "index.html", "utf8");
const js = fs.readFileSync(root + "terminal.js", "utf8");

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {} });
window.Element.prototype.scrollIntoView = function () { window.__scrolled = this.id || this.tagName; };
window.open = (u) => { window.__opened = u; };

window.eval(js);
const doc = window.document;
const input = doc.querySelector("#cmdline");
const out = doc.querySelector("#shellout");

const run = (cmd) => {
  out.innerHTML = "";
  input.value = cmd;
  doc.querySelector("#shell").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  return out.textContent;
};

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
};

console.log("terminal.js behaviour");
check("email assembled client-side", doc.querySelector("#mail").href === "mailto:1eriklinde@gmail.com", doc.querySelector("#mail").href);
check("email not in raw markup", !html.includes("1eriklinde@gmail.com"));
const mails = [...doc.querySelectorAll(".mail")];
check("every email link assembled", mails.length >= 2 && mails.every((a) => a.href === "mailto:1eriklinde@gmail.com"), mails.length + " links");

let o = run("help");
check("help lists commands", o.includes("ls") && o.includes("theme") && o.includes("open <project>"), o.slice(0, 60));

o = run("ls");
check("ls lists sections", o.includes("skills") && o.includes("experience") && o.includes("projects"));

window.__scrolled = null;
o = run("cat skills");
check("cat skills scrolls to #skills", window.__scrolled === "skills", String(window.__scrolled));

window.__scrolled = null;
o = run("cat skills.txt");
check("cat tolerates .txt suffix", window.__scrolled === "skills");

o = run("cat nope");
check("unknown section errors", o.includes("no such section"));

window.__scrolled = null;
o = run("open bastion");
check("open bastion scrolls to project", window.__scrolled === "bastion");

o = run("open nope");
check("unknown project errors", o.includes("no such project"));

o = run("frobnicate");
check("unknown command errors", o.includes("command not found"));

window.__scrolled = null;
o = run("skills");
check("bare alias 'skills' works", window.__scrolled === "skills");

o = run("whoami");
check("whoami prints identity", o.includes("Erik Linde"));

o = run("uptime");
check("uptime computes years", /up \d+y \d+m/.test(o), o);

o = run("theme light");
check("theme light applies", doc.documentElement.dataset.theme === "light");
o = run("theme");
check("bare theme toggles back", doc.documentElement.dataset.theme === "dark");

o = run("sudo rm -rf /");
check("sudo easter egg", o.includes("sudoers"));

run("help");
check("output pane opens", out.classList.contains("open"));
run("exit");
check("exit closes pane", !out.classList.contains("open") && out.textContent === "");

o = run("<script>alert(1)</script>");
check("echo escapes html", !out.querySelector("script") && out.textContent.includes("<script>"));

// copy button — lives on /yours, driven by chrome.js
{
  const yoursHtml = fs.readFileSync(root + "yours.html", "utf8");
  const chromeJs = fs.readFileSync(root + "chrome.js", "utf8");
  const d2 = new JSDOM(yoursHtml, { runScripts: "outside-only", url: "http://localhost/yours" });
  let copied = null;
  d2.window.navigator.clipboard = { writeText: async (t) => { copied = t; } };
  d2.window.eval(chromeJs);
  const ydoc = d2.window.document;
  const btn = ydoc.querySelector(".copy");
  check("copy button exists", !!btn);
  check("copy button targets a real element", !!btn && !!ydoc.getElementById(btn.dataset.copy));
  btn.dispatchEvent(new d2.window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));
  check("copy writes the prompt to the clipboard", (copied || "").includes("guide.md"), String(copied).slice(0, 40));
  check("copy button confirms", btn.textContent === "copied", btn.textContent);
}

// the article pages exist, carry their article, and link back to the CV
for (const [page, id] of [["build.html", "build"], ["onwards.html", "onwards"], ["yours.html", "yours"]]) {
  const html = fs.readFileSync(root + page, "utf8");
  const pd = new JSDOM(html).window.document;
  check(page + " carries its article", !!pd.querySelector('article#' + id + '.story'));
  check(page + " links back to the CV", !!pd.querySelector('.backlink a[href="/"]'));
  check(page + " has its own title", (pd.title || "").length > 10 && pd.title !== "Erik Linde — IT operations & monitoring engineer", pd.title);
}

// the view counter: counts, renders, and never breaks the page
{
  const buildHtml = fs.readFileSync(root + "build.html", "utf8");
  const chromeJs = fs.readFileSync(root + "chrome.js", "utf8");

  const d3 = new JSDOM(buildHtml, { runScripts: "outside-only", url: "http://localhost/build" });
  let sent = null;
  d3.window.fetch = (u, o) => {
    sent = { url: u, method: o && o.method };
    return Promise.resolve({ ok: true, json: async () => ({ total: 1234, countries: 7, top: [{ cc: "SE", n: 9 }] }) });
  };
  d3.window.eval(chromeJs);
  await new Promise((r) => setTimeout(r, 20));
  check("view counter posts to /api/hits", sent && sent.url === "/api/hits" && sent.method === "POST", JSON.stringify(sent));
  check("view counter renders the sentence", d3.window.document.querySelector("#hits-line").textContent === "1,234 page views from 7 countries", d3.window.document.querySelector("#hits-line").textContent);
  check("view counter names countries, not codes", /Sweden 9/.test(d3.window.document.querySelector("#hits-top").textContent), d3.window.document.querySelector("#hits-top").textContent);

  // the endpoint being down must not take the page with it
  const d4 = new JSDOM(buildHtml, { runScripts: "outside-only", url: "http://localhost/build" });
  d4.window.fetch = () => Promise.reject(new Error("offline"));
  let threw = false;
  try { d4.window.eval(chromeJs); await new Promise((r) => setTimeout(r, 20)); } catch (e) { threw = true; }
  check("a dead counter does not break the page", !threw && /counted at the edge/.test(d4.window.document.querySelector("#hits-line").textContent));

  // singulars, which the very first visitor would otherwise see as "1 page views"
  const d5 = new JSDOM(buildHtml, { runScripts: "outside-only", url: "http://localhost/build" });
  d5.window.fetch = () => Promise.resolve({ ok: true, json: async () => ({ total: 1, countries: 1, top: [{ cc: "SE", n: 1 }] }) });
  d5.window.eval(chromeJs);
  await new Promise((r) => setTimeout(r, 20));
  check("view counter gets singulars right", d5.window.document.querySelector("#hits-line").textContent === "1 page view from 1 country", d5.window.document.querySelector("#hits-line").textContent);
}

// the counter must never be sent anything about the visitor
{
  const worker = fs.readFileSync(path.join(root, "..", "src/index.js"), "utf8");
  const schema = fs.readFileSync(path.join(root, "..", "schema.sql"), "utf8");
  // the country is read from Cloudflare's edge; nothing else about the request is
  check("worker reads no request headers", !/headers\.get|cf-connecting-ip|user-agent|referer/i.test(worker));
  check("worker reads only the country off cf", (worker.match(/request\.cf\.\w+/g) || []).every((m) => m === "request.cf.country"), String(worker.match(/request\.cf\.\w+/g)));
  check("worker writes no per-visit row", !/INSERT INTO (visits|log|events)/i.test(worker) && !/Date\.now|new Date/.test(worker));
  const columns = schema.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  check("schema is one key and one number", /k TEXT PRIMARY KEY/.test(columns) && /n INTEGER/.test(columns) && !/\b(ip|addr|agent|time|date|ref)\w*/i.test(columns), columns.replace(/\s+/g, " ").trim());
}

// the CV no longer carries the articles, and its cards point at the new URLs
check("CV has no story articles", !doc.querySelector(".story"));
for (const href of ["/build", "/onwards", "/yours"]) {
  check("CV links to " + href, !!doc.querySelector('a[href="' + href + '"]'));
}

// history + tab completion
input.value = "help";
doc.querySelector("#shell").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const kd = (key) => { const e = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }); input.dispatchEvent(e); };
input.value = ""; kd("ArrowUp");
check("up-arrow recalls history", input.value === "help", input.value);
input.value = "exp"; kd("Tab");
check("tab completes 'exp' -> 'experience'", input.value === "experience", input.value);
out.innerHTML = ""; input.value = "e"; kd("Tab");
check("ambiguous tab lists candidates", out.textContent.includes("exit") && out.textContent.includes("experience"), out.textContent);
input.value = "open bas"; kd("Tab");
check("tab completes project arg", input.value === "open bastion", input.value);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
