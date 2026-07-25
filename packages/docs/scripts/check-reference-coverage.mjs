#!/usr/bin/env node
// check-reference-coverage.mjs — every skill and agent on disk has exactly one reference page,
// and every reference page describes something that still exists.
//
// The gate is deliberately fail-closed and derives visibility from coverage itself rather than
// from a declared field. A skill added without a page fails here, which is the property that
// matters: nothing ships undocumented by default. The alternative — a `visibility:` field with
// no default — needs a manifest that does not exist yet, and would additionally have to explain
// why the artifacts declaring `user-invocable: false` all carry public pages today (they are
// auto-invoked, not secret). Coverage answers the question without inventing that taxonomy.
//
// The reverse direction is the rename check: `mk-loop` → `loop` moved a directory while a page
// and a citation still named the old one. A page with no artifact behind it fails here now.
//
// Exemptions live in this file, not in prose, so they cannot drift from the check. Both lists
// are empty on purpose: today every artifact has a page. Adding an entry is a reviewed decision.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = join(HERE, "..", "content", "docs", "reference");
const REPO_ROOT = join(HERE, "..", "..", "..");
const CLAUDE_ROOT = join(REPO_ROOT, ".claude");

// Artifacts that intentionally have no public page. Each entry needs a reason.
const UNDOCUMENTED_ARTIFACTS = new Set([]);
// Reference pages that intentionally describe no single artifact, beyond the section indexes.
const PAGES_WITHOUT_ARTIFACT = new Set(["index"]);

// `.claude/agents/` holds generated indexes alongside the agent definitions.
const NON_AGENT_FILES = new Set(["AGENTS_INDEX.md", "SKILLS_INDEX.md"]);

function listDir(dir, keep) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter(keep).map((e) => e.name);
}

const SURFACES = [
  {
    kind: "skill",
    sourceDir: join(CLAUDE_ROOT, "skills"),
    pagesDir: join(DOCS_ROOT, "skills"),
    // A skill is a directory holding a SKILL.md — `.venv` and loose files are not skills.
    artifacts: (dir) => listDir(dir, (e) => e.isDirectory() && existsSync(join(dir, e.name, "SKILL.md"))),
  },
  {
    kind: "agent",
    sourceDir: join(CLAUDE_ROOT, "agents"),
    pagesDir: join(DOCS_ROOT, "agents"),
    artifacts: (dir) =>
      listDir(dir, (e) => e.isFile() && e.name.endsWith(".md") && !NON_AGENT_FILES.has(e.name)).map((n) =>
        n.replace(/\.md$/, ""),
      ),
  },
];

const problems = [];
let artifactTotal = 0;

for (const surface of SURFACES) {
  if (!existsSync(surface.sourceDir) || !statSync(surface.sourceDir).isDirectory()) {
    problems.push({ kind: surface.kind, id: surface.sourceDir, why: "source directory is missing" });
    continue;
  }

  const artifacts = surface.artifacts(surface.sourceDir);
  const pages = new Set(
    listDir(surface.pagesDir, (e) => e.isFile() && e.name.endsWith(".mdx")).map((n) => n.replace(/\.mdx$/, "")),
  );
  artifactTotal += artifacts.length;

  for (const id of artifacts) {
    if (pages.has(id) || UNDOCUMENTED_ARTIFACTS.has(`${surface.kind}:${id}`)) continue;
    problems.push({
      kind: surface.kind,
      id,
      why: `no page at reference/${surface.kind}s/${id}.mdx — every ${surface.kind} needs one, or an exemption in this script`,
    });
  }

  const known = new Set(artifacts);
  for (const page of pages) {
    if (known.has(page) || PAGES_WITHOUT_ARTIFACT.has(page)) continue;
    problems.push({
      kind: surface.kind,
      id: page,
      why: `no ${surface.kind} of this name exists on disk — the artifact was renamed or removed`,
    });
  }
}

for (const p of problems) {
  console.log(`ERROR ${p.kind} ${p.id}\n        ${p.why}`);
}

console.log(`\nchecked ${artifactTotal} artifact(s) — ${problems.length} coverage problem(s)`);
process.exit(problems.length > 0 ? 1 : 0);
