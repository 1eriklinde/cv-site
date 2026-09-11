// Records what the served PDF was generated from.
//
// The PDF is produced by printing the CV in a browser, which nothing in the
// pipeline can do for itself. This stamps the pairing instead: the text the CV
// printed, and the bytes that came out. The test fails if either moves without
// the other, so a stale PDF cannot ship quietly.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { cvPrintText, pdfPageCount } from "./cv-text.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);

const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
const pdf = fs.readFileSync(path.join(ROOT, "public/erik-linde-cv.pdf"));
const pages = pdfPageCount(pdf);
if (pages !== 4) throw new Error(`the CV is ${pages} pages; refusing to stamp anything but 4`);

const manifest = {
  note: "Written by npm run pdf:stamp after regenerating the PDF. Do not edit by hand.",
  cvText: sha(cvPrintText(html)),
  pdfBytes: sha(pdf),
  pages,
  stamped: new Date().toISOString().slice(0, 10)
};
fs.writeFileSync(path.join(ROOT, "pdf-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`stamped: cv ${manifest.cvText}, pdf ${manifest.pdfBytes}, ${pages} pages`);
