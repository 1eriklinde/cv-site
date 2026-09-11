// The text the CV actually prints, as one normalised string.
//
// Shared by the stamper and the test so both compute it the same way: if they
// ever disagreed, the check would be worse than useless.
import { JSDOM } from "jsdom";

// Everything the print stylesheet hides. Keep in step with the @media print
// rule in styles.css — the test below asserts that it is.
export const PRINT_HIDDEN = [
  ".statusline", ".shell", ".shellout", ".ribbon", ".ribbon-axis",
  ".foot", ".cards", ".endcard", ".backlink", ".nav"
];

export function cvPrintText(html) {
  const doc = new JSDOM(html).window.document;
  for (const sel of PRINT_HIDDEN) {
    for (const el of doc.querySelectorAll(sel)) el.remove();
  }
  for (const el of doc.querySelectorAll("script, style")) el.remove();
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export function pdfPageCount(buf) {
  const m = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/.exec(buf.toString("latin1"));
  return m ? Number(m[1]) : 0;
}
