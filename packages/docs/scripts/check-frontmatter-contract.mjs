#!/usr/bin/env node
// check-frontmatter-contract.mjs — a declared source of truth must point at a file that exists.
//
// The field only earns its place if it is checked. An unverified `sourceOfTruth` is a claim that
// rots exactly like the prose it was meant to anchor: the runtime file gets renamed, the page
// still names the old path, and nothing notices — which is the failure this whole phase exists
// to remove.
//
// Deliberately not enforced everywhere yet. The rollout is optional, then backfill, then
// required; requiring it today would fail 250 pages in one commit and teach people to add the
// field without checking it. REQUIRE_SOURCE_OF_TRUTH is the set already backfilled, and it is
// the list that grows.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = join(HERE, "..", "content", "docs");
const REPO_ROOT = join(HERE, "..", "..", "..");

// Pages that restate runtime facts and have been backfilled. Adding a page here makes its
// declaration mandatory from then on.
const REQUIRE_SOURCE_OF_TRUTH = new Set([
  "core-concepts/workflow.mdx",
  "core-concepts/gates.mdx",
  "reference/configuration.mdx",
  "reference/hooks.mdx",
  "reference/rules-index.mdx",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.name.endsWith(".mdx")) out.push(abs);
  }
  return out;
}

/** Read a scalar out of the frontmatter block without pulling in a YAML parser. */
function frontmatterValue(body, key) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(body);
  if (!fm) return null;
  const line = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(fm[1]);
  return line ? line[1].trim().replace(/^["']|["']$/g, "") : null;
}

const problems = [];
let declared = 0;

for (const abs of walk(DOCS_ROOT)) {
  const rel = abs.slice(DOCS_ROOT.length + 1).split("\\").join("/");
  const body = readFileSync(abs, "utf-8");

  const source = frontmatterValue(body, "sourceOfTruth");
  if (source) {
    declared++;
    if (!existsSync(join(REPO_ROOT, source))) {
      problems.push(`${rel}: sourceOfTruth "${source}" does not exist`);
    }
  } else if (REQUIRE_SOURCE_OF_TRUTH.has(rel)) {
    problems.push(`${rel}: restates runtime facts and must declare sourceOfTruth`);
  }

  const verified = frontmatterValue(body, "lastVerified");
  if (verified && !/^\d{4}-\d{2}-\d{2}$/.test(verified)) {
    problems.push(`${rel}: lastVerified "${verified}" is not an ISO date (YYYY-MM-DD)`);
  }
}

for (const p of problems) console.log(`ERROR ${p}`);
console.log(
  `\nchecked frontmatter on every page — ${declared} declare a source of truth, ${problems.length} problem(s)`,
);
process.exit(problems.length > 0 ? 1 : 0);
