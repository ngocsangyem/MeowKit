#!/usr/bin/env node
// lint-prose-slop.mjs — catches the prose habits that make documentation read as generated.
//
// Two tiers, and the split is the whole design. HARD is only patterns with no legitimate use in
// technical prose: an em dash, a throat-clearing opener, a business-jargon phrase, a rhetorical
// contrast. Those are string matches with no judgement in them, so failing CI on one is safe.
// WARN is everything that has a real use here — "actually" in an explanation, "How it works" as
// a heading, "never" in a safety rule. Those are reported for a human to read and are never a
// build failure, because a linter that cries wolf on correct writing gets muted.
//
// HARD applies to the canonical learning path only. Enforcing it across the whole tree would
// fail on pages nobody has rewritten yet, which turns a quality gate into a wall. Pages join
// HARD_TIER as they are rewritten.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = join(HERE, "..", "content", "docs");
const REPO_ROOT = join(HERE, "..", "..", "..");

// The pages a first-time reader passes through. Add a page here when it has been rewritten.
const HARD_TIER = new Set([
  "introduction.mdx",
  "installation.mdx",
  "quick-start.mdx",
  "glossary.mdx",
  "design.mdx",
  "core-concepts/what-is-meowkit.mdx",
  "core-concepts/how-it-works.mdx",
  "core-concepts/workflow.mdx",
  "core-concepts/gates.mdx",
  "guides/build-a-feature.mdx",
  "guides/fix-a-bug.mdx",
  "guides/debug-effectively.mdx",
  "guides/review-code.mdx",
  "guides/ship-safely.mdx",
  "guides/autonomous-build.mdx",
  "guides/jira-integration.mdx",
  "guides/confluence-integration.mdx",
  "cli/index.mdx",
  "workflows/index.mdx",
]);

// History is not rewritten to satisfy a linter.
const EXEMPT_DIRS = new Set(["changelog"]);

const HARD = [
  { id: "em-dash", re: /—/g, why: "an em dash in prose reads as generated; use a comma, a full stop, or a colon" },
  {
    id: "throat-clearing",
    re: /\b(here's (the thing|what|this|that|why)|the uncomfortable truth is|it turns out|let me be clear|the truth is,|i'm going to be honest|can we talk about|let me walk you through|in this section, we'll|as we'll see)\b/gi,
    why: "delete the wind-up and start at the sentence that carries information",
  },
  {
    id: "emphasis-crutch",
    re: /\b(full stop\.|let that sink in|make no mistake|here's why that matters|this matters because)/gi,
    why: "if it matters, the sentence should show it rather than announce it",
  },
  {
    id: "business-jargon",
    re: /\b(navigate (the )?challenges|unpack (the )?analysis|lean into|game-changer|double down|deep dive|take a step back|moving forward|circle back|on the same page|in today's|at the end of the day|in a world where)\b/gi,
    why: "say the plain thing instead",
  },
  {
    id: "filler",
    re: /\b(at its core|it's worth noting|when it comes to|the reality is)\b/gi,
    why: "carries no information; cut it and the sentence still means the same",
  },
  {
    id: "vague-declarative",
    re: /\b(the reasons are structural|the implications are significant|this is the deepest problem|the stakes are high|the consequences are real)\b/gi,
    why: "name the reason, the implication, or the consequence",
  },
  {
    id: "rhetorical-contrast",
    re: /\b(not just \w[\w\s]{0,30}? but( also)?|isn't the problem\.|the answer isn't\b|that's it\. that's the|is a feature, not a bug)/gi,
    why: "state the point directly rather than staging it against a strawman",
  },
  {
    id: "meta-commentary",
    re: /(^|\s)(hint:|plot twist:|spoiler:|you already know this, but)/gi,
    why: "talk about the subject, not about the writing",
  },
];

const WARN = [
  {
    id: "hedge-adverb",
    re: /\b(really|just|literally|genuinely|honestly|simply|actually|deeply|truly|fundamentally|inherently|inevitably|interestingly|importantly|crucially)\b/gi,
    why: "usually deletable without changing the meaning",
  },
  {
    id: "lazy-extreme",
    re: /\b(everyone|everybody|nobody)\b/gi,
    why: "check this is literally true; if it is a safety rule, it probably is",
  },
  {
    id: "wh-opener",
    re: /^(What|When|Where|Which|Who|Why|How)\s/,
    why: "a sentence opening on a question word often buries the answer",
    // Headings are exactly where a Wh- opener belongs, so they are not flagged.
    skipLine: (line) => line.startsWith("#") || line.startsWith("|"),
  },
  {
    id: "passive-tell",
    re: /\b(was created$|is believed that|mistakes were made|the decision was reached)\b/gi,
    why: "name who did it",
  },
];

/** Blank code fences and inline code so examples are never read as prose. Newlines preserved. */
function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (s) => " ".repeat(s.length));
}

/** Frontmatter is metadata, not prose, but `description` is read by humans, so keep it. */
function stripFrontmatterKeys(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n/, (fm) =>
    fm
      .split("\n")
      .map((l) => (/^(title|description):/.test(l) ? l : " ".repeat(l.length)))
      .join("\n"),
  );
}

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

const files = walk(DOCS_ROOT);
const hardFindings = [];
const warnFindings = [];

for (const abs of files) {
  const rel = relative(DOCS_ROOT, abs).split("\\").join("/");
  const isHard = HARD_TIER.has(rel);
  const lines = stripCode(stripFrontmatterKeys(readFileSync(abs, "utf-8"))).split("\n");
  lines.forEach((line, i) => {
    const at = { file: relative(REPO_ROOT, abs), line: i + 1 };
    for (const rule of HARD) {
      for (const m of line.matchAll(rule.re)) {
        (isHard ? hardFindings : warnFindings).push({ ...at, ...rule, match: m[0].trim() });
      }
    }
    for (const rule of WARN) {
      if (rule.skipLine?.(line)) continue;
      for (const m of line.matchAll(new RegExp(rule.re.source, rule.re.flags.replace("g", "") + "g"))) {
        warnFindings.push({ ...at, ...rule, match: m[0].trim() });
      }
    }
  });
}

for (const f of hardFindings) {
  console.log(`ERROR ${f.file}:${f.line}  [${f.id}] ${f.match}\n        ${f.why}`);
}

// The warn tier is for a human to read, and a thousand individual lines is not readable. Group
// it so the shape is visible: which rule, how often, and where to start looking.
const byRule = new Map();
for (const f of warnFindings) {
  if (!byRule.has(f.id)) byRule.set(f.id, []);
  byRule.get(f.id).push(f);
}
for (const [id, group] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  const worst = [...new Map(group.map((g) => [g.file, g])).keys()].slice(0, 3);
  console.log(`warn  [${id}] ${group.length} across ${new Set(group.map((g) => g.file)).size} file(s) — e.g. ${worst.join(", ")}`);
}

console.log(
  `\nlinted ${files.length} pages (${HARD_TIER.size} on the hard tier) — ${hardFindings.length} error(s), ${warnFindings.length} warning(s)`,
);
process.exit(hardFindings.length > 0 ? 1 : 0);
