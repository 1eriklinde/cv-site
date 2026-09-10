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

// First prompt and first live deploy. The story is "empty directory to public
// URL"; everything after the first ship is a different story and is excluded,
// otherwise this section inflates every time it regenerates itself.
const T0 = "23:07";           // first prompt, 21:07:54Z
const SHIP = "23:31";         // first deploy live, 21:31:49Z
const SHIP_LABEL = "23 min 55 s";
// Absolute cutoff. Comparing "HH:MM" strings breaks the moment the session
// runs past midnight ("00:07" sorts before "23:31"), which silently pulled
// later work into the to-first-ship totals.
const SHIP_TS = Date.parse("2026-09-10T21:32:00Z");

// Opus 5 list rates, $/million tokens. Cache reads bill at ~0.1x input,
// cache writes at ~1.25x input.
const RATE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

// The story. Times are real; the prose is editorial.
const STORY = [
  ["23:07", "An empty directory.", "No repo, no wrangler installed, no Cloudflare account set up. A CV in a PDF in the Downloads folder."],
  ["23:08", "Agreed what to build.", "Terminal aesthetic, and a round of CV adjustments. The PDF itself had to be parsed the hard way — no poppler on this machine, so pdf.js in a scratch directory."],
  ["23:10", "Checked the current docs.", "Cloudflare moved static hosting to Workers static assets. Worth two minutes to confirm rather than deploy to Pages out of habit."],
  ["23:13", "Self-hosted the typeface.", "Two woff2 files, 43 KB. No Google Fonts request, so nothing a visitor does here is visible to anyone else."],
  ["23:17", "Wrote the page.", "One HTML file, one stylesheet, the command line, the deploy config. No framework, so there was nothing to scaffold and nothing to wait for."],
  ["23:18", "Looked at it, and found a bug.", "The green dot marking the current role had been pushed onto its own line by a flexbox rule. Markup checks would never have caught it; a screenshot did."],
  ["23:21", "Chased a phantom.", "Mobile looked broken. Measuring the viewport showed Chrome clamps headless windows to 500px — the layout was fine and the screenshot was lying. Confirmed by measuring real overflow at 375px: none."],
  ["23:24", "Wrote 23 tests. Two failed.", "One assertion was wrong. The other was a genuine defect: typing HTML into the command line put it straight into innerHTML unescaped."],
  ["23:26", "Broke it with my own hardening.", "Adding a strict CSP silently killed the uptime ribbon — style-src 'self' blocks inline style attributes, so the segment widths vanished with no error anywhere. Another screenshot caught it. Moved to classes, kept the policy strict."],
  ["23:28", "Cloudflare said no.", "The first login died server-side: wrangler asks for an OAuth scope list its own client rejects. The device flow with an explicit narrower scope list worked."],
  ["23:31", "Live.", "Ten assets uploaded, worker updated, edge triggers deployed — 14.3 seconds, on a URL anyone could open."],
];

const MILESTONES = [
  ["23:17", "page written"],
  ["23:24", "tests"],
  ["23:31", "LIVE"],
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
  if (Date.parse(d.timestamp) >= SHIP_TS) continue; // the story ends at the first live deploy
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

// ---- sparkline for the stat panel ----
const SW = 168, SH = 26;
const sSlot = SW / mins.length;
const sBarW = Math.max(2, sSlot - 1.5);
const spark = mins.map((m, i) => {
  const h = Math.max(1.5, (perMin.get(m).out / peak) * SH);
  return `<rect x="${(i * sSlot).toFixed(1)}" y="${(SH - h).toFixed(1)}" width="${sBarW.toFixed(1)}" height="${h.toFixed(1)}"/>`;
}).join("");

const REPO = "github.com/1eriklinde/cv-site";

// Compact pipeline for the panel. The colophon carries the annotated version;
// this one is the summary, so it drops the captions.
const PW = 560, PH = 34, pBox = 120, pGap = (PW - 4 * pBox) / 3;
const pNodes = ["git push", "npm test", "wrangler deploy", "live"];
const pipeline = `<svg class="pipe" viewBox="0 0 ${PW} ${PH}" role="img" aria-label="Pipeline: a push runs the tests, and only a passing run deploys to Cloudflare's edge.">` +
  pNodes.map((n, i) => {
    const x = i * (pBox + pGap);
    const last = i === pNodes.length - 1;
    const box = `<rect class="pipe-box${last ? " pipe-box-live" : ""}" x="${x.toFixed(1)}" y="4" width="${pBox}" height="26" rx="2"/>`;
    const txt = `<text class="pipe-t${last ? " pipe-t-live" : ""}" x="${(x + pBox / 2).toFixed(1)}" y="21" text-anchor="middle">${n}</text>`;
    const arrow = last ? "" :
      `<g class="pipe-line"><path d="M${(x + pBox + 4).toFixed(1)} 17 H${(x + pBox + pGap - 7).toFixed(1)}"/>` +
      `<path d="M${(x + pBox + pGap - 12).toFixed(1)} 12.5 l5 4.5 -5 4.5"/></g>`;
    return box + txt + arrow;
  }).join("") + `</svg>`;

const panel = `  <aside class="ship" aria-labelledby="ship-h">
    <p class="ship-claim" id="ship-h"><span class="st st-ok">SHIPPED</span> How I built and deployed this site, from an empty folder to a public URL, in under 25 minutes, for free.</p>
    <p class="ship-stats"><svg class="spark" viewBox="0 0 ${SW} ${SH}" role="img" aria-label="Tokens generated per minute across the build.">${spark}</svg> <span class="nb">${SHIP_LABEL}</span> · ${total.turns} model turns · ${total.calls} tool calls · three bugs caught before it shipped</p>
    ${pipeline}
    <p class="ship-stats"><a href="https://${REPO}">${REPO}</a> — a push to main runs the tests, and deploys only if they pass.</p>
    <p class="ship-stats"><b>€0</b> to host, deploy and run: Cloudflare's free plan and GitHub Actions. <a href="#timeline">read the build log</a></p>
  </aside>`;

// ---- story ----
const storyRows = STORY.map(([when, lead, text]) =>
  `      <tr><td class="tl-when">${when}</td><td class="tl-what"><b>${lead}</b> ${text}</td></tr>`
).join("\n");

const toolList = [...tools.entries()].sort((a, b) => b[1] - a[1])
  .map(([n, c]) => `${n} ×${c}`).join(" · ");

const section = `  <section id="timeline" aria-labelledby="h-tl">
    <h2 id="h-tl" class="cmd"><span class="prompt">$</span> <span class="c">journalctl -u build --since ${T0} --until ${SHIP}</span></h2>

    <p class="colo-lede">Built in a terminal with Claude Code on a Thursday evening, from an empty folder to a public URL in <span class="nb">${SHIP_LABEL}</span>. It went quickly not because nothing went wrong — four things did — but because each one surfaced within a minute of being introduced. Everything below is read out of the session log; the timestamps are real.</p>

    ${svg}
    <p class="tl-legend"><span class="tl-key tl-key-out"></span>tokens written <span class="tl-key tl-key-think"></span>of which reasoning</p>

    <table class="tl-table">
      <tbody>
${storyRows}
      </tbody>
    </table>

    <dl class="skills">
      <dt>to first ship</dt>
      <dd><span class="nb">${SHIP_LABEL}</span> from the first sentence to a URL anyone could open, and roughly three of those minutes were spent logging in to Cloudflare twice.</dd>
      <dt>work done</dt>
      <dd>${total.turns} model turns, ${total.calls} tool calls — ${toolList}.</dd>
      <dt>tokens</dt>
      <dd>${(total.out / 1000).toFixed(0)}k generated, ${(total.think / 1000).toFixed(0)}k of that reasoning rather than writing. About $${cost.toFixed(0)} of model time at Opus 5 list rates; it ran on a subscription, so nothing was billed per token.</dd>
      <dt>caught before shipping</dt>
      <dd>A flexbox rule orphaning the status dot, unescaped input reaching <code>innerHTML</code>, and a Content-Security-Policy that silently disabled part of the layout. Two of the three were only visible in a screenshot.</dd>
      <dt>what a person did</dt>
      <dd>Chose the direction, answered ${tools.get("AskUserQuestion") ?? 0} decisions, and drove the CV adjustments that shaped what this page says. The typing was automated. The judgement was not.</dd>
    </dl>
  </section>`;

const idx = path.join(ROOT, "public/index.html");
let html = fs.readFileSync(idx, "utf8");

const write = (name, body, fallback) => {
  const a = `  <!-- ${name}:start -->`, b = `  <!-- ${name}:end -->`;
  const block = `${a}\n${body}\n${b}`;
  if (html.includes(a)) html = html.replace(new RegExp(`${a}[\\s\\S]*?${b}`), () => block);
  else html = fallback(block);
};

write("ship", panel, (block) => html.replace("  </header>\n", `  </header>\n\n${block}\n`));
write("timeline", section, (block) => html.replace('  <footer class="foot">', `${block}\n\n  <footer class="foot">`));
fs.writeFileSync(idx, html);
console.log(`timeline: ${mins[0]}–${mins[mins.length - 1]}, ${total.turns} turns, ${total.calls} tool calls, ${(total.out/1000).toFixed(0)}k out, $${cost.toFixed(2)} at list rates`);
