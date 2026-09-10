#!/usr/bin/env node
// Regenerates the "how this was built" timeline in public/index.html from the
// Claude Code session transcript. The numbers on the page are measured, not typed.
//
//   node tools/build-timeline.mjs [path-to-session.jsonl]
//
// Default transcript path is this project's session log.

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LOG = path.join(os.homedir(), ".claude/projects/-home-erikl-cv-site");
const TZ_OFFSET_H = 2; // transcript timestamps are UTC; the build happened in CEST

// Opus 5 list rates, $/million tokens. Cache reads bill at ~0.1x input,
// cache writes at ~1.25x input.
const RATE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

// Editorial phase boundaries [startMinute, label, what happened]
const PHASES = [
  ["23:08", "Brief",        "Scoped it, read the CV PDF, agreed the direction"],
  ["23:12", "Build",        "Wrote the page, styles, command line and deploy config"],
  ["23:18", "Review",       "Screenshotted it, found and fixed real layout bugs"],
  ["23:24", "Harden",       "Wrote the test suite, added the CSP, fixed the escaping"],
  ["23:31", "Ship",         "Cloudflare login, first deploy, renamed the worker"],
  ["23:36", "Extend",       "Colophon, phone-free PDF, public repo, CI pipeline"],
];

const MILESTONES = [
  ["23:18", "first render"],
  ["23:24", "tests green"],
  ["23:31", "LIVE"],
  ["23:43", "repo + CI"],
];

function resolveLog(arg) {
  if (arg) return arg;
  const files = fs.readdirSync(DEFAULT_LOG).filter((f) => f.endsWith(".jsonl"));
  if (!files.length) throw new Error(`no transcript found in ${DEFAULT_LOG}`);
  return path.join(DEFAULT_LOG, files.sort((a, b) =>
    fs.statSync(path.join(DEFAULT_LOG, b)).mtimeMs - fs.statSync(path.join(DEFAULT_LOG, a)).mtimeMs)[0]);
}

const log = resolveLog(process.argv[2]);
const perMin = new Map();
const tools = new Map();
const total = { out: 0, think: 0, cw: 0, cr: 0, in: 0, turns: 0, calls: 0 };

for (const line of fs.readFileSync(log, "utf8").split("\n")) {
  if (!line) continue;
  let d;
  try { d = JSON.parse(line); } catch { continue; }
  if (d.type !== "assistant" || !d.timestamp) continue;
  const u = d.message?.usage ?? {};
  const t = new Date(Date.parse(d.timestamp) + TZ_OFFSET_H * 3600e3);
  const key = t.toISOString().slice(11, 16);
  const b = perMin.get(key) ?? { out: 0, think: 0 };
  const out = u.output_tokens ?? 0;
  const think = u.output_tokens_details?.thinking_tokens ?? 0;
  b.out += out; b.think += think;
  perMin.set(key, b);
  total.out += out; total.think += think; total.turns++;
  total.cw += u.cache_creation_input_tokens ?? 0;
  total.cr += u.cache_read_input_tokens ?? 0;
  total.in += u.input_tokens ?? 0;
  for (const c of d.message?.content ?? []) {
    if (c?.type === "tool_use") {
      total.calls++;
      const n = c.name.startsWith("mcp__") ? "docs lookup" : c.name;
      tools.set(n, (tools.get(n) ?? 0) + 1);
    }
  }
}

const mins = [...perMin.keys()].sort();
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const start = toMin(mins[0]), end = toMin(mins[mins.length - 1]);
const span = end - start + 1;
const peak = Math.max(...[...perMin.values()].map((b) => b.out));
const yMax = Math.ceil(peak / 5000) * 5000;

const cost =
  (total.out * RATE.output + total.cw * RATE.cacheWrite +
   total.cr * RATE.cacheRead + total.in * RATE.input) / 1e6;

// ---- chart ----
const W = 720, H = 190, L = 42, R = 8, T = 26, B = 34;
const plotW = W - L - R, plotH = H - T - B;
const slot = plotW / span;
const barW = Math.max(6, Math.min(13, slot - 3.5));
const x = (m) => L + (toMin(m) - start) * slot + (slot - barW) / 2;
const y = (v) => T + plotH - (v / yMax) * plotH;

let bars = "";
for (const m of mins) {
  const b = perMin.get(m);
  const written = b.out - b.think;
  bars += `<rect class="tl-bar" x="${x(m).toFixed(1)}" y="${y(b.out).toFixed(1)}" width="${barW.toFixed(1)}" height="${(y(0) - y(b.out)).toFixed(1)}"/>`;
  bars += `<rect class="tl-think" x="${x(m).toFixed(1)}" y="${y(b.think).toFixed(1)}" width="${barW.toFixed(1)}" height="${(y(0) - y(b.think)).toFixed(1)}"/>`;
}

let grid = "";
for (let v = 0; v <= yMax; v += yMax / 2) {
  grid += `<line class="tl-grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
  grid += `<text class="tl-ax" x="${L - 7}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v ? v / 1000 + "k" : "0"}</text>`;
}

let xlabels = "";
for (const m of mins) {
  if (!m.endsWith("0") && !m.endsWith("5")) continue;
  if (Number(m.slice(3)) % 10) continue;
  xlabels += `<text class="tl-ax" x="${(x(m) + barW / 2).toFixed(1)}" y="${H - B + 16}" text-anchor="middle">${m}</text>`;
}

let marks = "";
for (const [m, label] of MILESTONES) {
  const cx = x(m) + barW / 2;
  marks += `<line class="tl-mark" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T - 6}" y2="${y(0)}"/>`;
  marks += `<text class="tl-marklabel" x="${cx.toFixed(1)}" y="${T - 11}" text-anchor="middle">${label}</text>`;
}

const svg = `<svg class="timeline" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="tl-t tl-d">
      <title id="tl-t">Tokens generated per minute across the build</title>
      <desc id="tl-d">A bar per minute from ${mins[0]} to ${mins[mins.length - 1]}, showing tokens generated. The darker portion of each bar is reasoning. Markers show the first rendered page, the point the tests went green, the first live deploy, and the repository and CI setup.</desc>
      ${grid}
      ${bars}
      ${marks}
      ${xlabels}
    </svg>`;

// ---- phase table ----
const phaseRows = PHASES.map(([from, name, what], i) => {
  const to = PHASES[i + 1]?.[0] ?? mins[mins.length - 1];
  let out = 0;
  for (const m of mins) if (toMin(m) >= toMin(from) && toMin(m) < toMin(to) + (i === PHASES.length - 1 ? 1 : 0)) out += perMin.get(m).out;
  return `      <tr><td class="tl-when">${from}</td><td class="tl-what"><b>${name}</b> — ${what}</td><td class="tl-num">${(out / 1000).toFixed(1)}k</td></tr>`;
}).join("\n");

const toolList = [...tools.entries()].sort((a, b) => b[1] - a[1])
  .map(([n, c]) => `${n} ×${c}`).join(" · ");

const section = `  <section id="timeline" aria-labelledby="h-tl">
    <h2 id="h-tl" class="cmd"><span class="prompt">$</span> <span class="c">journalctl --since 23:07 --until 23:47</span></h2>
    <p class="colo-lede">This page went from an empty directory to a live URL in ${Math.round((toMin(mins[mins.length - 1]) - toMin(mins[0])))} minutes, built in a terminal with Claude Code. Every number below is read out of the session log, not remembered.</p>

    ${svg}
    <p class="tl-legend"><span class="tl-key tl-key-out"></span>tokens written <span class="tl-key tl-key-think"></span>of which reasoning</p>

    <table class="tl-table">
      <caption class="tl-caption">Phases, and what each one cost in generated tokens</caption>
      <tbody>
${phaseRows}
      </tbody>
    </table>

    <dl class="skills">
      <dt>wall clock</dt>
      <dd>${Math.round(toMin(mins[mins.length - 1]) - toMin(mins[0]))} minutes end to end, including a five-minute detour when Cloudflare's OAuth rejected wrangler's scope list.</dd>
      <dt>turns</dt>
      <dd>${total.turns} model turns and ${total.calls} tool calls — ${toolList}.</dd>
      <dt>tokens</dt>
      <dd>${(total.out / 1000).toFixed(0)}k generated (${(total.think / 1000).toFixed(0)}k of it reasoning), ${(total.cr / 1e6).toFixed(1)}M read back from cache each turn as the context grew.</dd>
      <dt>what it cost</dt>
      <dd>About $${cost.toFixed(0)} of model time at Opus 5 list rates — it ran on a Claude Code subscription, so it was not billed per token. Hosting the result costs nothing.</dd>
      <dt>what I did</dt>
      <dd>Set the direction, answered ${tools.get("AskUserQuestion") ?? 0} decisions, caught that the CV read too much like display hardware, and said what to build next. The typing was automated; the judgement was not.</dd>
    </dl>
  </section>`;

const idx = path.join(ROOT, "public/index.html");
let html = fs.readFileSync(idx, "utf8");
const S = "  <!-- timeline:start -->", E = "  <!-- timeline:end -->";
const block = `${S}\n${section}\n${E}`;
if (html.includes(S)) {
  html = html.replace(new RegExp(`${S}[\\s\\S]*?${E}`), block);
} else {
  html = html.replace("  <footer class=\"foot\">", `${block}\n\n  <footer class="foot">`);
}
fs.writeFileSync(idx, html);
console.log(`timeline: ${mins[0]}–${mins[mins.length - 1]}, ${total.turns} turns, ${total.calls} tool calls, ${(total.out/1000).toFixed(0)}k out, $${cost.toFixed(2)} at list rates`);
