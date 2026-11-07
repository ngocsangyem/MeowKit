#!/usr/bin/env node
// Pinned oracle for `check-rule-survival.cjs`: the safety text that must survive any
// compression of the always-on rule set. Taken from the uncompressed rules at
// b225a319699fdffce38f8c0ac63e30465a31137c. Needles are matched against whitespace-
// normalized file text, so re-wrapping or table re-padding does not hide a deletion.

/** The 7 always-on rule files searched for every item below. */
const ALWAYS_ON_FILES = [
	"meowkit-core.md",
	"security-rules.md",
	"injection-rules.md",
	"gate-rules.md",
	"core-behaviors.md",
	"development-rules.md",
	"agent-conduct.md",
];

const injectionHeadings = [];
for (let n = 1; n <= 11; n += 1) {
	injectionHeadings.push({ name: `injection-rules heading "Rule ${n}"`, needle: `## Rule ${n}:` });
}

const securityRows = [
	"Hardcoded secrets: API keys, passwords, tokens, JWT secrets in source code",
	"`any` type in TypeScript",
	"SQL queries with string interpolation/template literals",
	"`localStorage` for auth tokens",
	"`v-html` with user-provided content",
	"`UserDefaults` for sensitive data (Swift)",
	"Row Level Security disabled or missing (Supabase/PostgreSQL)",
	"Controllers without auth guards (unless explicitly public and documented)",
	"`process.env` access without ConfigService wrapper (NestJS)",
	"Anon key used in server-side context",
	"Disabled certificate validation (Swift)",
	"`CASCADE DELETE` without explicit approval in plan",
].map((row) => ({ name: `security-rules blocked-pattern row "${row}"`, needle: row }));

const gateConditions = [
	["Gate 1 condition 1", "**Plan file exists**"],
	["Gate 1 condition 2", "**All required sections are populated:**"],
	["Gate 1 condition 3", "**Human has explicitly typed approval.**"],
	["Gate 1 condition 4", "**A fresh approval receipt is stamped on the plan**"],
	["Gate 2 condition 1", "**Verdict file exists**"],
	["Gate 2 condition 2", "**No FAIL dimensions**"],
	["Gate 2 condition 3", "**All WARN items acknowledged**"],
	["Gate 2 condition 4", "**Security scan shows no BLOCK items**"],
	["Gate 2 condition 5", "Same standard as Gate 1"],
].map(([name, needle]) => ({ name: `${name} (${needle})`, needle }));

const a1Block = [
	"**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT",
	"**Summary:** [1-2 sentence summary of what was accomplished]",
	"**Concerns/Blockers:** [if applicable — omit if DONE with no concerns]",
].map((line) => ({ name: `agent-conduct A1 status-block line "${line}"`, needle: line }));

const a1TableRows = [
	"| **DONE** | Task completed successfully | Proceed to next step |",
	"| **DONE_WITH_CONCERNS** | Completed but flagged doubts | If correctness concern → address before review. If tech debt → note, proceed. |",
	"| **BLOCKED** | Cannot complete task | Assess blocker → provide more context / break task down / escalate to user. NEVER retry same approach. |",
	"| **NEEDS_CONTEXT** | Missing information to proceed | Provide missing context → re-dispatch |",
].map((row) => ({ name: `agent-conduct A1 status-table row "${row.slice(0, 28)}…"`, needle: row }));

const coreBehaviorHeadings = [
	"## 1. Surface Assumptions",
	"## 2. Manage Confusion Actively",
	"## 3. Push Back When Warranted",
	"## 4. Enforce Simplicity",
	"## 5. Maintain Scope Discipline",
	"## 6. Verify, Don't Assume",
].map((heading) => ({ name: `core-behaviors heading "${heading}"`, needle: heading }));

/** One phrase per MUST/NEVER/ALWAYS line of the uncompressed development-rules (15 lines). */
const developmentPhrases = [
	"ALWAYS use kebab-case",
	"ALWAYS keep code files under 200 lines",
	'NEVER create new "enhanced" or "v2" files',
	"ALWAYS run the compile/build command",
	"NEVER simulate, mock, or stub implementation code",
	"NEVER finish a session with failing tests",
	"NEVER ignore failing tests, delete tests, weaken assertions",
	"ALWAYS use conventional commits",
	"NEVER include AI references in commit messages",
	"NEVER push to main/master directly",
	"NEVER force-push unless the user explicitly requests it",
	"ALWAYS commit frequently with descriptive messages",
	"ALWAYS pull before push",
	"ALWAYS declare docs impact",
	"ALWAYS apply default output limits",
].map((phrase) => ({ name: `development-rules phrase "${phrase}"`, needle: phrase }));

const ORACLE = [
	...injectionHeadings,
	...securityRows,
	...gateConditions,
	...a1Block,
	...a1TableRows,
	...coreBehaviorHeadings,
	...developmentPhrases,
];

module.exports = { ORACLE, ALWAYS_ON_FILES };
