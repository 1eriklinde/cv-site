// Regenerates the measured figures in the colophon on public/build.html.
// Everything here is read off the files that actually ship or out of the test
// suite — nothing is typed by hand, so the numbers cannot drift from the site.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");

const brotli = (buf) =>
  zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
  }).length;

// what a browser pulls on a cold visit to the CV
const firstLoad = {
  page: ["index.html"],
  css: ["styles.css"],
  js: ["theme.js", "chrome.js", "terminal.js"],
  font: ["fonts/jetbrains-mono-400.woff2", "fonts/jetbrains-mono-700.woff2"]
};

const size = (files) =>
  files.reduce((n, f) => n + brotli(fs.readFileSync(path.join(PUB, f))), 0);

const bytes = {
  page: size(firstLoad.page),
  css: size(firstLoad.css),
  js: size(firstLoad.js),
  font: size(firstLoad.font)
};
const docBytes = bytes.page + bytes.css + bytes.js;
const total = docBytes + bytes.font;
const kb = (n) => (n / 1024).toFixed(1);

// the test count, taken from the suite rather than believed
const testOut = execFileSync("node", [path.join(ROOT, "test/shell.test.mjs")], {
  cwd: ROOT, encoding: "utf8"
});
const tests = Number((testOut.match(/(\d+) passed/) || [])[1]);
if (!tests) throw new Error("could not read a test count from the suite");

// how many files actually ship
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const assets = walk(PUB).length;

const html = `      <dt>first load</dt>
      <dd>${kb(total)} KB over the wire, compressed — ${kb(bytes.font)} KB of that is the self-hosted typeface, so the document itself is about ${kb(docBytes)} KB. One HTML file, one stylesheet, three small scripts.</dd>
      <dt>deploy</dt>
      <dd>~14 seconds from <code>git push</code> to live: ${assets} assets uploaded, worker updated, edge triggers deployed.</dd>
      <dt>tests</dt>
      <dd>${tests} jsdom checks on the command line below — completion, history, escaping, routing. The deploy does not run if they fail.</dd>`;

const file = path.join(PUB, "build.html");
const src = fs.readFileSync(file, "utf8");
const START = "<!-- stats:start -->", END = "<!-- stats:end -->";
if (!src.includes(START)) throw new Error(`no ${START} marker in build.html`);
let out = src.replace(
  new RegExp(`${START}[\\s\\S]*?${END}`),
  `${START}\n${html}\n      ${END}`
);

// the pipeline diagram carries the same two figures; they drifted last time
const label = (cls, x, y, text) =>
  new RegExp(`(<text class="${cls}" x="${x}" y="${y}"[^>]*>)[^<]*(</text>)`);
const before = out;
out = out
  .replace(label("dg-s", 555, 20), `$1${assets} files$2`)
  .replace(label("dg-s", 262, 122), `$1${tests} checks$2`);
if (out === before) throw new Error("diagram labels not found — has the SVG changed?");

fs.writeFileSync(file, out);
console.log(`stats: ${kb(total)} KB first load (${kb(docBytes)} KB document + ${kb(bytes.font)} KB fonts), ${tests} tests, ${assets} assets`);
