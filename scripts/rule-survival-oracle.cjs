#!/usr/bin/env node
// Pinned oracle for `check-rule-survival.cjs`: the safety text that must survive any
// compression of the always-on rule set. Taken from the uncompressed rules at
// b225a319699fdffce38f8c0ac63e30465a31137c. Needles are matched against whitespace-
// normalized file text, so re-wrapping or table re-padding does not hide a deletion.

/** The 6 always-on rule files searched for every item below. */
const ALWAYS_ON_FILES = [
	"meowkit-core.md",
	"security-rules.md",
	"injection-rules.md",
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

/**
 * The Enforcement clause's disposition for code that already exists.
 *
 * Pinned separately from the blocked-pattern rows because it is the sentence that
 * stops a reviewer from silently rewriting shipped code around a flagged pattern:
 * existing code is WARNed and documented, never auto-fixed, because it may carry
 * context the agent lacks. The needle deliberately excludes the entrypoint names
 * beside it — those are routing surfaces and get renamed; the disposition must not
 * disappear with a rename.
 */
const securityEnforcement = [
	{
		name: 'security-rules Enforcement clause (existing code: WARN, documented, never auto-fixed)',
		needle: "flag as **WARN**, document it in the verdict, do not auto-fix",
	},
];

/** What stays true after the approval gates were removed: the ship check and its scope. */
const shipCheck = [
	["ship check runs on ship commands", "the `pre-ship` hook runs lint on the changed files, the tests related to them and a type-check"],
	["ship check says when tests did not run", "it runs lint and type-check only and says so"],
].map(([name, needle]) => ({ name: `meowkit-core ${name}`, needle }));

const a1Block = [
	"**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT",
	"**Summary:** [1-2 sentence summary of what was accomplished]",
	"**Concerns/Blockers:** [if applicable — omit if DONE with no concerns]",
].map((line) => ({ name: `agent-conduct A1 status-block line "${line}"`, needle: line }));

const a1TableRows = [
	"| **DONE** | Task completed successfully | Proceed to next step |",
	"| **DONE_WITH_CONCERNS** | Completed but flagged doubts | If correctness concern → address before review. If tech debt → note, proceed. |",
	"| **BLOCKED** | Cannot complete task | Assess blocker → provide more context / break task down / escalate to user. Do not retry the same approach. |",
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

/** The bodies of the two behaviors whose scope matters most: when to stop, and what counts as done. */
const coreBehaviorBodies = [
	"stop, name the specific confusion, present the tradeoff or the question, and wait for the answer",
	"Call a task done only with evidence from a check that ran",
].map((phrase) => ({ name: `core-behaviors body "${phrase.slice(0, 28)}…"`, needle: phrase }));

/** One phrase per rule of development-rules: each rule must survive compression, in its plain wording. */
const developmentPhrases = [
	"Name files in kebab-case",
	"Keep code files under 200 lines; split a large file by concern",
	'rather than creating an "enhanced" or "v2" copy',
	"run the build or compile command and fix every error",
	"Do not mock, stub or simulate implementation code",
	"When tests exist, end the session with them passing",
	"do not delete tests, weaken assertions or add fake data",
	"Use conventional commits",
	"Leave AI references out of commit messages",
	"NEVER push to main/master directly",
	"NEVER force-push unless the user asks for it",
	"descriptive messages, committed often",
	"Pull before you push",
	"declare docs impact",
	"Tool output stays in context, so cap it at the source",
].map((phrase) => ({ name: `development-rules phrase "${phrase}"`, needle: phrase }));

const ORACLE = [
	...injectionHeadings,
	...securityRows,
	...securityEnforcement,
	...shipCheck,
	...a1Block,
	...a1TableRows,
	...coreBehaviorHeadings,
	...coreBehaviorBodies,
	...developmentPhrases,
];

module.exports = { ORACLE, ALWAYS_ON_FILES };
