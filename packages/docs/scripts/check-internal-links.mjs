#!/usr/bin/env node
// check-internal-links.mjs — resolves every internal doc link against the pages that exist.
//
// Written against the page set on disk rather than a crawler because the docs app serves
// everything through one `app/[...slug]` catch-all: a crawler sees a 200 for any path the
// catch-all accepts, so a broken link only shows up as an empty page a reader has to find.
// Resolving against the file tree turns that into a build-time failure.
//
// Deliberately dependency-free. The obvious alternative pulls in a link checker that has to be
// taught the same catch-all exception, which is more moving parts than the check itself.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = join(HERE, "..", "content", "docs");
const REPO_ROOT = join(HERE, "..", "..", "..");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.name.endsWith(".mdx")) out.push(abs);
  }
  return out;
}

/** File path → the URL Fumadocs serves it at. `index.mdx` collapses onto its directory. */
function urlFor(abs) {
  const rel = relative(DOCS_ROOT, abs).split("\\").join("/").replace(/\.mdx$/, "");
  return "/" + (rel === "index" ? "" : rel.replace(/\/index$/, ""));
}

const files = walk(DOCS_ROOT);
const pages = new Set(files.map(urlFor));

// Routes the app serves that are not MDX pages under content/docs.
const NON_MDX_ROUTES = new Set(["/", "/llms.txt", "/llms-full.txt", "/sitemap.xml", "/robots.txt"]);

// Links inside fenced code are examples, not navigation.
function stripFences(text) {
  return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
}

const LINK_RE = /\]\((\/[^)\s"']*)\)|href="(\/[^"]*)"/g;

const broken = [];
for (const abs of files) {
  const rel = relative(REPO_ROOT, abs);
  const lines = stripFences(readFileSync(abs, "utf-8")).split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(LINK_RE)) {
      const raw = m[1] ?? m[2];
      if (!raw) continue;
      const target = raw.split("#")[0].replace(/\/$/, "") || "/";
      if (NON_MDX_ROUTES.has(target)) continue;
      if (pages.has(target)) continue;
      broken.push({ file: rel, line: i + 1, target: raw });
    }
  });
}

for (const b of broken) {
  console.log(`ERROR ${b.file}:${b.line}  ${b.target} — no page serves this path`);
}
console.log(`\nchecked ${files.length} pages — ${broken.length} broken internal link(s)`);
process.exit(broken.length > 0 ? 1 : 0);
