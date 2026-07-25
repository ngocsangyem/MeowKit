#!/usr/bin/env node
// scan-stale-values.mjs — catches doc statements that the runtime has already moved past.
//
// This exists because of what the P0 audit actually found: the docs were not wrong from
// neglect, they were wrong because a path, an env var, or a directory changed under them and
// nothing failed. Every rule below encodes one such change, so the next one fails CI instead
// of reaching a reader.
//
// Two severities. ERROR is a statement that is provably wrong today — CI fails. WARN is a
// statement that is true now but rots by construction (hard-coded counts); it is reported so
// the rewrite pass can retire it, and does not block.
//
// The token list lives here, not in prose, so it cannot drift from the check that enforces it.
// Where a source of truth exists in the repo, the rule derives from it rather than restating
// it — see the model-id rule.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "docs");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The changelog is a historical record: past releases legitimately describe paths and flags
// that no longer exist. Scanning it would demand rewriting history to satisfy a linter.
const EXEMPT_FILES = new Set(["changelog.mdx"]);

/** Model ids the runtime detector actually classifies — the allowed set is derived, not listed,
 *  so adding a model to the harness does not require editing this script. */
function recognizedModelIds() {
  const detector = join(REPO_ROOT, ".claude", "hooks", "handlers", "model-detector.cjs");
  const matrix = join(REPO_ROOT, ".claude", "skills", "autobuild", "references", "adaptive-density-matrix.md");
  const ids = new Set();
  for (const path of [detector, matrix]) {
    let text;
    try {
      text = readFileSync(path, "utf-8");
    } catch {
      continue; // a missing source narrows the allowed set; it never invents one
    }
    for (const m of text.matchAll(/\b(opus|sonnet|haiku)-\d+-\d+\b/g)) ids.add(m[0]);
  }
  return ids;
}

const MODEL_IDS = recognizedModelIds();

/** Count artifacts on disk so a stale number in prose can be reported next to the real one. */
function actualCount(kind) {
  const skillsDir = join(REPO_ROOT, ".claude", "skills");
  const dirs = {
    // A skill is a directory holding a SKILL.md — `.venv` and loose files are not skills.
    skills: [skillsDir, (e) => e.isDirectory() && existsSync(join(skillsDir, e.name, "SKILL.md"))],
    agents: [join(REPO_ROOT, ".claude", "agents"), (e) => e.isFile() && e.name.endsWith(".md")],
    "rule files": [join(REPO_ROOT, ".claude", "rules"), (e) => e.isFile() && e.name.endsWith(".md")],
  };
  const spec = dirs[kind];
  if (!spec) return null;
  try {
    return readdirSync(spec[0], { withFileTypes: true }).filter(spec[1]).length;
  } catch {
    return null;
  }
}

const RULES = [
  {
    id: "legacy-memory-path",
    severity: "error",
    re: /\.claude\/memory/g,
    why: "curated stores, logs, and the wiki index resolve under `.meowkit/` — see resolve-state-dir.ts",
  },
  {
    id: "legacy-hook-profile-env",
    severity: "error",
    re: /\bMEOW_HOOK_PROFILE\b/g,
    // The configuration reference documents the alias once, on purpose.
    allow: (line) => /legacy alias/i.test(line),
    why: "`MEOWKIT_HOOK_PROFILE` is the current name; the alias is documented once in the config reference",
  },
  {
    id: "renamed-skill-dir",
    severity: "error",
    re: /\.claude\/skills\/mk-loop\b/g,
    why: "the directory is `.claude/skills/loop/`; only the migrate bundles keep an `mk-` prefix",
  },
  {
    id: "removed-cli-flag",
    severity: "error",
    re: /mewkit memory --show\b/g,
    why: "the dispatcher never forwarded `--show`; the flag does not exist",
  },
  {
    id: "wrong-config-path",
    severity: "error",
    re: /(?<![\w/.])\.meowkit\.config\.json/g,
    why: "the generated config is `.claude/meowkit.config.json`",
  },
  {
    id: "unprefixed-gemini-key",
    severity: "error",
    re: /(?<!MEOWKIT_)\bGEMINI_API_KEY\b/g,
    // The env helper really does fall back to the bare name, so a line that documents the
    // fallback as a fallback is correct — only lines presenting it as the variable to set fail.
    allow: (line) => /fall(s)? ?back|legacy/i.test(line),
    why: "`MEOWKIT_GEMINI_API_KEY` is canonical; the bare name is only a fallback in the env helper",
  },
  {
    id: "unknown-model-id",
    severity: "error",
    re: /\b(?:opus|sonnet|haiku)-\d+-\d+\b/g,
    allow: (_line, match) => MODEL_IDS.has(match),
    why: "the model detector does not classify this id — it will fall through to the default tier",
  },
  {
    id: "hard-coded-count",
    severity: "warn",
    re: /\b\d{2,3} (?:specialist )?(skills|agents|rule files|hooks)\b/g,
    why: "counts rot; use a generated value or non-numeric phrasing",
    detail: (match) => {
      const kind = /(skills|agents|rule files|hooks)/.exec(match)?.[1];
      const actual = actualCount(kind);
      return actual === null ? null : `actual today: ${actual} ${kind}`;
    },
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.name.endsWith(".mdx") && !EXEMPT_FILES.has(entry.name)) out.push(abs);
  }
  return out;
}

function scanFile(abs) {
  const rel = relative(REPO_ROOT, abs);
  const findings = [];
  const lines = readFileSync(abs, "utf-8").split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      for (const m of line.matchAll(rule.re)) {
        if (rule.allow?.(line, m[0])) continue;
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: rel,
          line: i + 1,
          match: m[0],
          why: rule.why,
          detail: rule.detail?.(m[0]) ?? null,
        });
      }
    }
  });
  return findings;
}

const files = statSync(DOCS_ROOT).isDirectory() ? walk(DOCS_ROOT) : [];
const findings = files.flatMap(scanFile);
const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

for (const f of [...errors, ...warns]) {
  const tag = f.severity === "error" ? "ERROR" : "warn ";
  const extra = f.detail ? ` (${f.detail})` : "";
  console.log(`${tag} ${f.file}:${f.line}  [${f.rule}] ${f.match}${extra}\n        ${f.why}`);
}

console.log(
  `\nscanned ${files.length} pages — ${errors.length} error(s), ${warns.length} warning(s)` +
    (MODEL_IDS.size ? `; model ids recognized: ${[...MODEL_IDS].sort().join(", ")}` : ""),
);

process.exit(errors.length > 0 ? 1 : 0);
