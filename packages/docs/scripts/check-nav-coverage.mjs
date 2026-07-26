#!/usr/bin/env node
// check-nav-coverage.mjs — every page a reader can reach must be reachable from the sidebar.
//
// The root meta.json used to end in a "..." catch-all, which meant nothing could ever be
// orphaned — and also meant internal pages nobody curated appeared in the navigation next to
// Installation. Removing the catch-all buys a deliberate sidebar and costs the guarantee, so
// this check buys the guarantee back: a page that is neither listed in a meta.json nor retired
// in redirects.json fails CI.
//
// A page is allowed to be exactly one of three things — navigable, redirected, or absent.
// Silently-live-but-unlisted is the state this exists to make impossible.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = join(HERE, "..", "content", "docs");
const REPO_ROOT = join(HERE, "..", "..", "..");

const { redirects } = JSON.parse(readFileSync(join(HERE, "..", "redirects.json"), "utf-8"));
const retired = new Set(redirects.map((r) => r.from));

/** File path → the URL Fumadocs serves it at. `index.mdx` collapses onto its directory. */
function urlFor(abs) {
  const rel = relative(DOCS_ROOT, abs).split("\\").join("/").replace(/\.mdx$/, "");
  return "/" + (rel === "index" ? "" : rel.replace(/\/index$/, ""));
}

function allPages(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allPages(abs));
    else if (entry.name.endsWith(".mdx")) out.push(abs);
  }
  return out;
}

const covered = new Set();

// Walk one directory's meta.json and mark everything it puts in the sidebar. A directory with
// no meta.json lists all of its contents, which is Fumadocs' own default. "..." stands for
// every direct child not named explicitly — close enough to the real semantics that a genuinely
// orphaned page cannot hide behind the difference.
function cover(dir) {
  const metaPath = join(dir, "meta.json");
  const children = readdirSync(dir, { withFileTypes: true });
  const named = children
    .filter((e) => e.isDirectory() || e.name.endsWith(".mdx"))
    .map((e) => e.name.replace(/\.mdx$/, ""));

  let listed = named;
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    const entries = (meta.pages ?? []).filter((p) => !/^---.*---$/.test(p));
    const explicit = entries.filter((p) => p !== "...");
    const directNames = new Set(explicit.filter((p) => !p.includes("/")));
    listed = entries.includes("...")
      ? [...explicit, ...named.filter((n) => !directNames.has(n))]
      : explicit;
  }

  for (const item of listed) {
    const target = join(dir, item);
    if (existsSync(target + ".mdx")) covered.add(urlFor(target + ".mdx"));
    else if (existsSync(target) && statSync(target).isDirectory()) cover(target);
  }
}

cover(DOCS_ROOT);

// A folder whose meta.json sets `root: true` becomes its own sidebar tab, so it is an entry
// point in its own right and is never listed by a parent. CLI, Workflows, and Reference all
// reach the reader this way.
function coverRootTabs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = join(dir, entry.name);
    const metaPath = join(abs, "meta.json");
    if (existsSync(metaPath) && JSON.parse(readFileSync(metaPath, "utf-8")).root === true) cover(abs);
    coverRootTabs(abs);
  }
}
coverRootTabs(DOCS_ROOT);

const orphans = allPages(DOCS_ROOT)
  .map((abs) => ({ url: urlFor(abs), file: relative(REPO_ROOT, abs) }))
  .filter((p) => !covered.has(p.url) && !retired.has(p.url));

// A `root: true` folder is its own sidebar tree, and this check used to treat that as proof it
// was reachable. It is not: a tree with no tab pointing into it is invisible, and CLI, Reference,
// and Workflows sat that way — every page inside them "covered", none of them findable. Coverage
// answers "is this page in a tree"; only this answers "can anyone get to that tree".
const rootTrees = [];
function collectRootTrees(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = join(dir, entry.name);
    const metaPath = join(abs, "meta.json");
    if (existsSync(metaPath) && JSON.parse(readFileSync(metaPath, "utf-8")).root === true) {
      rootTrees.push("/" + relative(DOCS_ROOT, abs).split("\\").join("/"));
    }
    collectRootTrees(abs);
  }
}
collectRootTrees(DOCS_ROOT);

// Both files that can carry a link into a root tree: the sidebar tabs and the header nav.
const navSources = [
  join(HERE, "..", "app", "[...slug]", "layout.tsx"),
  join(HERE, "..", "lib", "layout.shared.tsx"),
].filter((p) => existsSync(p));
const tabUrls = navSources.flatMap((p) =>
  [...readFileSync(p, "utf-8").matchAll(/url:\s*['"](\/[^'"]*)['"]/g)].map((m) => m[1]),
);

// `tabMode="top"` renders LayoutTabs into `[grid-area:main]` — the same grid area as the page
// content container — with an opaque background and z-10. Two items in one grid area overlap, so
// it covers the entire article. It looks like the obvious way to make the tabs visible, which is
// why it needs a guard rather than a comment.
// Comments are stripped first: both of these files explain in prose why tabMode="top" is wrong,
// and a guard that fires on its own explanation is a guard nobody can satisfy.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
}
const topTabMode = navSources.filter((p) => /tabMode\s*=\s*["'{]?\s*["']top["']/.test(stripComments(readFileSync(p, "utf-8"))));

const unreachable = rootTrees.filter((tree) => !tabUrls.some((u) => u === tree || u.startsWith(tree + "/")));
const servedUrls = new Set(allPages(DOCS_ROOT).map(urlFor));
const deadTabs = tabUrls.filter((u) => !servedUrls.has(u.replace(/\/$/, "")) && !retired.has(u));

for (const t of unreachable) {
  console.log(`ERROR ${t} — a root:true tree with no tab pointing into it; nothing in the sidebar reaches it`);
}
for (const u of deadTabs) {
  console.log(`ERROR nav link "${u}" — no page serves this path`);
}
for (const p of topTabMode) {
  console.log(`ERROR ${relative(REPO_ROOT, p)} sets tabMode="top" — LayoutTabs then shares [grid-area:main] with the page content and covers the whole article`);
}

for (const o of orphans) {
  console.log(`ERROR ${o.file}  ${o.url} — served but in no meta.json and not retired in redirects.json`);
}

const failures = orphans.length + unreachable.length + deadTabs.length + topTabMode.length;
console.log(
  `\nchecked ${covered.size} navigable page(s), ${retired.size} retired URL(s), ` +
    `${rootTrees.length} root tree(s) against ${tabUrls.length} tab(s) — ${failures} problem(s)`,
);
process.exit(failures > 0 ? 1 : 0);
