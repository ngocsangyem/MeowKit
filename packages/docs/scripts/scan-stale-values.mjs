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
//
// Deliberately NOT checked: model ids. classifyModel() in model-detector.cjs ends in a keyword
// fallback — any string containing "opus", "sonnet", or "haiku" classifies — so there is no
// such thing as an id the detector rejects, and a rule claiming to catch one would assert a
// guarantee the runtime does not make. What can genuinely go wrong there (a model with no
// MODEL_TIERS entry silently taking fallback density) is a runtime gap, not a docs error.
//
// Scanning is line-by-line, so a token split across a line break is not matched. MDX
// formatting keeps inline code on one line, so this has no practical reach today.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "docs");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The changelog is a historical record: past releases legitimately describe paths and flags
// that no longer exist. Scanning it would demand rewriting history to satisfy a linter.
// Exempted by directory rather than filename so splitting it into current + archive pages
// cannot silently re-enrol history in the scan.
const EXEMPT_DIRS = new Set(["changelog"]);

/** Count artifacts on disk so a stale number in prose can be reported next to the real one. */
function actualCount(kind) {
  const skillsDir = join(REPO_ROOT, ".claude", "skills");
  const dirs = {
    // A skill is a directory holding a SKILL.md — `.venv` and loose files are not skills.
    skills: [skillsDir, (e) => e.isDirectory() && existsSync(join(skillsDir, e.name, "SKILL.md"))],
    // The agents directory also holds generated indexes; counting those reported 43 against
    // pages that correctly said 41, which would have pushed the rewrite pass the wrong way.
    agents: [
      join(REPO_ROOT, ".claude", "agents"),
      (e) => e.isFile() && e.name.endsWith(".md") && !/^(AGENTS|SKILLS)_INDEX\.md$/.test(e.name),
    ],
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

// The phase sequence, read from the rule file that defines it rather than retyped here. Every
// page that copied this list had drifted: one called nine steps "7-phase", another dropped
// Verify, and none agreed on where Simplify sits. A copy is the bug — so the check is not
// "does this copy match" but "is there a copy at all".
const PHASE_SEQUENCE = (() => {
  const src = join(REPO_ROOT, ".claude", "rules", "phase-contracts.md");
  const m = /<!--\s*Workflow phase sequence:\s*(.+?)\s*-->/.exec(readFileSync(src, "utf-8"));
  if (!m) throw new Error(`no phase-sequence fingerprint in ${src}`);
  return m[1].split(">").map((p) => p.split(":")[1].trim());
})();

const PHASE_ALT = PHASE_SEQUENCE.join("|");
const PHASE_CHAIN = new RegExp(
  `(?:${PHASE_ALT})(?:\\s*(?:→|->)\\s*(?:\\[[^\\]]*\\]\\s*(?:→|->)\\s*)?(?:Phase\\s*[\\d.]+[:.]?\\s*)?(?:${PHASE_ALT})){3,}`,
  "g",
);

// One page owns the pipeline. The changelog is history and is exempt by directory already.
const PHASE_LIST_OWNER = join("packages", "docs", "content", "docs", "core-concepts", "workflow.mdx");

const RULES = [
  {
    id: "copied-phase-list",
    severity: "error",
    re: PHASE_CHAIN,
    skipFile: (rel) => rel === PHASE_LIST_OWNER,
    why: "the phase list lives on /core-concepts/workflow — link it instead of restating it",
  },
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
    // The alias is documented on purpose, but only where the line also names the current
    // variable. Keying the exemption to the phrase alone would let a line that inverts the
    // precedence ("the legacy alias takes priority") pass simply for saying "legacy alias".
    allow: (line) => /legacy alias/i.test(line) && /\bMEOWKIT_HOOK_PROFILE\b/.test(line),
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
    // Both the root dotfile and the pre-move provider-dir location. Readers fall back to the
    // latter so old installs keep working, but no page should still teach it.
    severity: "error",
    re: /(?<![\w/.])\.meowkit\.config\.json|\.claude\/meowkit\.config\.json/g,
    why: "the project config is `.meowkit/config.json`",
  },
  {
    id: "unprefixed-gemini-key",
    severity: "error",
    re: /(?<!MEOWKIT_)\bGEMINI_API_KEY\b/g,
    // The env helper really does fall back to the bare name, so a line may mention it — but
    // only when that same line names the canonical variable. Exempting on the word "legacy"
    // alone would pass "set the legacy GEMINI_API_KEY directly", which is the opposite advice.
    allow: (line) => /\bMEOWKIT_GEMINI_API_KEY\b/.test(line),
    why: "`MEOWKIT_GEMINI_API_KEY` is canonical; the bare name is only a fallback in the env helper",
  },
  {
    id: "legacy-env-path",
    severity: "error",
    re: /`?\.claude\/\.env(\.example)?`?/g,
    // The loaders still read the old path as a fallback, so a line documenting that is fine;
    // requiring the canonical path on the same line keeps the exemption from being a hole.
    allow: (line) => /\.meowkit\/\.env/.test(line),
    why: "the project dotenv is `.meowkit/.env`, shared by every provider",
  },
  {
    id: "retired-state-path",
    severity: "error",
    // The kit's own bookkeeping moved into the state root. Readers still fall back to these
    // paths so existing installs keep working, which is exactly why prose must not teach them:
    // a fallback that gets documented stops being a fallback and becomes a second answer.
    re: /`?\.claude\/(metadata\.json|pack-manifest\.json|harness-inventory\.json)`?/g,
    allow: (line) => /pre-move|fall(s|back)|legacy/i.test(line),
    why: "these live under `.meowkit/` now; the `.claude/` path is a read fallback, not a location to document",
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
    if (entry.isDirectory()) {
      if (!EXEMPT_DIRS.has(entry.name)) out.push(...walk(abs));
    } else if (entry.name.endsWith(".mdx")) out.push(abs);
  }
  return out;
}

function scanFile(abs) {
  const rel = relative(REPO_ROOT, abs);
  const findings = [];
  const lines = readFileSync(abs, "utf-8").split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.skipFile?.(rel)) continue;
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

console.log(`\nscanned ${files.length} pages — ${errors.length} error(s), ${warns.length} warning(s)`);

process.exit(errors.length > 0 ? 1 : 0);
