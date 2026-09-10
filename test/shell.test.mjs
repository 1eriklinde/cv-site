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
