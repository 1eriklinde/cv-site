#!/usr/bin/env node
// Promotes the most recently uploaded Worker version to production.
//
//   node tools/promote.mjs            promote the newest version
//   node tools/promote.mjs <id>       promote a specific version
//
// Pairs with `npm run preview`, which uploads a version and prints its preview
// URL without touching production.

import { execFileSync } from "child_process";

const run = (args) =>
  execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

let id = process.argv[2];

if (!id) {
  const versions = JSON.parse(run(["versions", "list", "--json"]));
  if (!versions.length) {
    console.error("No versions found. Run `npm run preview` first.");
    process.exit(1);
  }
  const newest = versions.reduce((a, b) =>
    Date.parse(b.metadata.created_on) > Date.parse(a.metadata.created_on) ? b : a);
  id = newest.id;
  console.log(`Promoting version ${id} (uploaded ${newest.metadata.created_on}).`);
}

run(["versions", "deploy", id, "--yes"]);
console.log("Promoted. Production now serves this version.");
