import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "../commands/doctor-checks.js";

// Gate-authority contract detector.
//
// The canonical contract (`.claude/rules/gate-rules.md` — The Gate Authority
// Invariant) says automation executes BETWEEN gates and never supplies the
// authority OF a gate. Evaluator verdicts, reviewer scores, and validator exit
// codes are evidence presented at a gate; they never clear it.
//
// This module scans prose for statements that GRANT automated approval
// authority, in either word order ("auto-approves Gate 2" / "Gate 2 ...
// auto-approved"), plus the known euphemisms ("the stamp counts", "Gate 1:
// Auto", "Skip Gate 1 user prompt").
//
// Boundary (honest): this is a FLOOR, not the contract. It matches a fixed
// pattern set over single lines. Paraphrase defeats any fixed pattern set — a
// file can grant automated approval authority in wording this never sees. The
// standing reviewer checklist item in `gate-rules.md` is the real enforcement;
// this module only makes the KNOWN regressions mechanical.

/** A single gate-authority finding with enough context to locate and fix it. */
export interface GateAuthorityViolation {
	file: string; // relative to the scanned root
	line: number; // 1-based
	found: string; // the offending line, trimmed
	expected: string; // what the contract requires instead
}

/** Suppression marker for prose that legitimately QUOTES the anti-pattern. */
const ALLOW_MARKER = "lint-allow-gate-authority";

/**
 * Statements that grant automated gate approval. Each entry is scoped to an
 * explicit `Gate 1` / `Gate 2` reference (or an unambiguous euphemism) so that
 * unrelated vocabulary — a skill's own "HARD GATE", a domain "gate" metaphor —
 * cannot trip the check.
 */
const PATTERNS: { name: string; re: RegExp; expected: string }[] = [
	{
		name: "auto-approve → gate",
		// The digit is REQUIRED. Without it this matches the bare word "gate" and
		// fires on every domain metaphor ("the quality gate stays manual").
		//
		// The gap is deliberately TIGHT. In every real instance the verb and its
		// gate are adjacent ("auto-approves Gate 2"). A wide gap lets one match
		// span two clauses, so a negated first clause swallows the gate reference
		// belonging to an asserting second clause — and the violation vanishes.
		re: /auto[-\s]?approv\w*[^.\n]{0,20}\bgates?\s*[12]\b/gi,
		expected: "automation executes between gates; a human approves the gate",
	},
	{
		name: "gate → auto-approved",
		re: /\bgate\s*[12]\b[^.\n]{0,30}auto[-\s]?approv\w*/gi,
		expected: "automation executes between gates; a human approves the gate",
	},
	{
		name: "gate bound to an auto value",
		re: /\bgate\s*[12]\s*:\s*auto/gi,
		expected: "Gate 1 / Gate 2 are human in every mode",
	},
	{
		name: "gate offering an auto alternative",
		re: /\bgate\s*[12]\b[^.\n]{0,30}\[[^\]\n]*auto[^\]\n]*\]/gi,
		expected: "the only gate outcome is human approval — drop the auto alternative",
	},
	{
		name: "stamp treated as authority",
		re: /\bstamp\s+counts\b/gi,
		expected: "an evaluator stamp is evidence presented at the gate, never the approval",
	},
	{
		name: "gate prompt skipped",
		re: /\bskips?\s+gate\s*[12]\b[^.\n]{0,30}(prompt|user)/gi,
		expected: "present the gate; a passing pre-check is evidence, not approval",
	},
];

/**
 * Words that flip a claim from ASSERTING automated approval to FORBIDDING it.
 * "Gate 2 is never auto-approved" states the contract — it must not be flagged.
 */
const NEGATION_RE =
	/\b(never|not|n't|no|none|cannot|can't|forbidden|prohibited|non-negotiable|mandatory|requires?\s+human|human\s+approval|explicitly\s+typed)\b/i;

/**
 * How far back from a match to look for the word that negates it. A negation
 * governs the clause it introduces, so it sits immediately before the claim
 * ("but never auto-approves Gate 2"), not in some unrelated later clause.
 */
const NEGATION_LOOKBEHIND = 48;

/**
 * True when the matched claim is negated rather than asserted.
 *
 * Scope matters enormously here. Testing the WHOLE line lets any incidental
 * negation elsewhere in the sentence disarm a real violation — e.g.
 * "auto-approves Gate 2 ... so no separate human click is required" is a
 * genuine violation whose "no" belongs to a different clause entirely. A safety
 * lint that misses its own threat model because of a distant "no" is worse than
 * no lint: it reports green over the exact regression it exists to catch.
 */
function isNegated(line: string, matchStart: number, matchText: string): boolean {
	const before = line.slice(Math.max(0, matchStart - NEGATION_LOOKBEHIND), matchStart);
	return NEGATION_RE.test(before) || NEGATION_RE.test(matchText);
}

/** True when the line is nothing but the suppression comment. */
function isStandaloneMarker(line: string): boolean {
	return /^\s*<!--\s*lint-allow-gate-authority\s*-->\s*$/.test(line);
}

/** Scan one file's prose for statements granting automated gate authority. */
export function scanForGateAuthority(root: string, relPath: string): GateAuthorityViolation[] {
	const abs = path.join(root, relPath);
	if (!fs.existsSync(abs)) return [];

	const violations: GateAuthorityViolation[] = [];
	const lines = fs.readFileSync(abs, "utf-8").split("\n");

	lines.forEach((text, idx) => {
		// A marker on the offending line suppresses that line. A marker on its own
		// line above suppresses the line below — the form used where a trailing
		// comment would render into prose (table rows, list items).
		//
		// The standalone requirement matters: an INLINE marker must not leak onto
		// the next line, or one suppressed line silently disarms its neighbour.
		if (text.includes(ALLOW_MARKER)) return;
		if (idx > 0 && isStandaloneMarker(lines[idx - 1])) return;

		// Negation is evaluated per MATCH, and EVERY match is examined — not just
		// the first. A line may state the contract and then carve an exception out
		// of it ("Gate 2 is never auto-approved, but fast mode auto-approves Gate 2
		// when tests pass"): the negated first clause must not excuse the second.
		for (const { re, expected } of PATTERNS) {
			for (const m of text.matchAll(re)) {
				if (isNegated(text, m.index, m[0])) continue;
				violations.push({ file: relPath, line: idx + 1, found: text.trim(), expected });
				return; // one finding per line is enough to locate and fix it
			}
		}
	});

	return violations;
}

/** Collect every `.md` file under `dir`, relative to `root`. */
function collectMarkdown(root: string, dir: string, acc: string[] = []): string[] {
	const abs = path.join(root, dir);
	if (!fs.existsSync(abs)) return acc;

	for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".git")) continue;
			collectMarkdown(root, rel, acc);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			acc.push(rel);
		}
	}
	return acc;
}

// ─── Command-vs-skill drift ──────────────────────────────────────────────────
//
// A slash command and its same-named skill are two descriptions of one behavior,
// and two descriptions drift. The rule (skill-authoring-rules.md → Commands vs
// Skills): the command is a DISPATCHER — usage, flags, dispatch, and a concise
// safety note pointing at the authority. The skill owns the procedure.
//
// When a command re-states the workflow, the two copies disagree the moment
// either changes, and an agent reading the command follows a stale procedure it
// has no reason to distrust. That is exactly the `/mk:fix` defect this lint
// exists to keep closed: the command described a Simple path that skipped the
// scout its own skill marked MANDATORY.
//
// Gate semantics are NOT re-detected here — `checkGateAuthority` above is the
// one gate-phrase detector, deliberately shared. Two blacklists drift apart, and
// the weaker one becomes the de-facto contract.

/**
 * The dispatchers this check contracts.
 *
 * Deliberately an allowlist, not "every same-name pair". Calibrating against all
 * paired commands surfaced 7 REAL drift findings (0 false positives) in six
 * commands outside this contract — autobuild, docs-init, help, retro, review,
 * ship — e.g. `review.md` carries a full "### Execution Steps" procedure that
 * duplicates its skill's. Those are pre-existing and each needs a considered
 * rewrite, not a lint flip; widening this set is the follow-up that does them.
 *
 * So this set is a floor that holds the line where it was drawn, not a claim
 * that the rest are clean. They are not. Widen it as each is thinned.
 */
const GOVERNED_DISPATCHERS = new Set(["fix", "cook", "plan", "advise"]);

/** Governed same-name command/skill pairs — the only files this drift check reads. */
function pairedCommands(root: string): string[] {
	const cmdDir = path.join(root, ".claude", "commands", "mk");
	const skillsDir = path.join(root, ".claude", "skills");
	if (!fs.existsSync(cmdDir) || !fs.existsSync(skillsDir)) return [];

	return (
		fs
			.readdirSync(cmdDir)
			.filter((f) => f.endsWith(".md"))
			.filter((f) => GOVERNED_DISPATCHERS.has(f.replace(/\.md$/, "")))
			// A command with no same-name skill has nowhere to delegate its procedure to,
			// so the same prose there is correct (skill-authoring-rules.md: "not every
			// command has a matching SKILL.md, and that is intentional").
			.filter((f) => fs.existsSync(path.join(skillsDir, f.replace(/\.md$/, ""), "SKILL.md")))
			.map((f) => path.join(".claude", "commands", "mk", f))
	);
}

/**
 * Prose that belongs to the SKILL, found in a command file.
 *
 * Scoped tightly on purpose. A command legitimately carries usage, flags, a
 * dispatch line, and a safety note — flagging those would make the lint noise,
 * and a noisy lint gets disabled. These patterns target the two things a
 * dispatcher can never own: step-by-step procedure, and memory writes.
 */
const COMMAND_DRIFT_PATTERNS: { name: string; re: RegExp; expected: string }[] = [
	{
		name: "numbered workflow steps",
		// "1. Do X" / "2. Then Y" — a procedure. One numbered line is a list; the
		// pattern needs a SECOND step on a later line to fire, so a lone "1." in a
		// safety note stays clean.
		//
		// `[ \t]*`, never `\s*`: `\s` matches newlines, so with `m` the match could
		// begin on the preceding blank line and report a line number one too low —
		// which silently pointed the allow-marker lookup at the wrong line.
		re: /^[ \t]*2\.[ \t]+\S/gm,
		expected: "the skill owns the procedure — the command dispatches to it",
	},
	{
		name: "memory-write instruction",
		re: /\b(Edit|write|append|update)\b[^.\n]{0,40}\.claude\/memory\//gi,
		expected: "memory writes belong to the skill's capture step, not the command",
	},
	{
		name: "memory store schema",
		re: /\b(fixes|review-patterns|architecture-decisions|security-findings)\.(json|md)\b/gi,
		expected: "the store's schema is the skill's business; the command must not restate it",
	},
	{
		name: "complexity classification table",
		re: /\|\s*(Simple|Standard|Complex|Moderate|Parallel)\s*\|/gi,
		expected: "classification is the skill's routing decision, not the command's",
	},
];

export interface CommandDriftFinding {
	file: string;
	line: number;
	found: string;
	expected: string;
}

/** Scan one command file for skill-owned prose. */
export function scanCommandForDrift(root: string, relPath: string): CommandDriftFinding[] {
	const abs = path.join(root, relPath);
	if (!fs.existsSync(abs)) return [];

	const findings: CommandDriftFinding[] = [];
	const lines = fs.readFileSync(abs, "utf-8").split("\n");
	const body = lines.join("\n");

	for (const { re, expected } of COMMAND_DRIFT_PATTERNS) {
		re.lastIndex = 0;
		const m = re.exec(body);
		if (!m) continue;
		// Locate the match's line for an actionable file:line.
		const line = body.slice(0, m.index).split("\n").length;
		if (lines[line - 1]?.includes(ALLOW_MARKER)) continue;
		findings.push({ file: relPath, line, found: m[0].trim().slice(0, 80), expected });
	}

	return findings;
}

/**
 * Command-vs-skill drift for every same-name pair.
 *
 * Scoped to PAIRED commands only. A standalone command (no matching skill) has
 * nowhere to delegate its procedure to, so the same prose there is correct —
 * per skill-authoring-rules.md, "not every command has a matching SKILL.md, and
 * that is intentional".
 */
export function checkCommandDrift(root: string): CheckResult[] {
	const commands = pairedCommands(root);
	if (commands.length === 0) {
		return [
			{ name: "Command-vs-skill drift", status: "pass", detail: "no same-name command/skill pairs", section: "Gates" },
		];
	}

	const findings = commands.flatMap((rel) => scanCommandForDrift(root, rel));

	if (findings.length === 0) {
		return [
			{
				name: "No command-vs-skill drift",
				status: "pass",
				detail: `${commands.length} paired command(s) are dispatchers: ${commands.map((c) => path.basename(c, ".md")).join(", ")}`,
				section: "Gates",
			},
		];
	}

	return [
		{
			name: `Command-vs-skill drift (${findings.length})`,
			status: "fail",
			detail: findings
				.map((f) => `${f.file}:${f.line} found "${f.found}" — expected "${f.expected}"`)
				.join("\n         "),
			section: "Gates",
		},
	];
}

/**
 * Run the gate-authority check over a tree of prose.
 *
 * `root` is the directory the scan is relative to; `scanDirs` are subtrees
 * within it. Defaults to the canonical `.claude` tree, and is reused verbatim
 * against the generated `plugin/` tree to prove canonical↔plugin parity.
 */
export function checkGateAuthority(
	root: string,
	opts: { scanDirs?: string[]; missingRootSeverity?: Status } = {},
): CheckResult[] {
	const scanDirs = opts.scanDirs ?? [".claude"];
	const present = scanDirs.filter((dir) => fs.existsSync(path.join(root, dir)));

	if (present.length === 0) {
		return [
			{
				name: "Gate-authority scan target",
				status: opts.missingRootSeverity ?? "fail",
				detail: `No scan target found under ${root}: ${scanDirs.join(", ")}`,
				section: "Gates",
			},
		];
	}

	const files = present.flatMap((dir) => collectMarkdown(root, dir));
	const violations = files.flatMap((rel) => scanForGateAuthority(root, rel));

	if (violations.length === 0) {
		return [
			{
				name: "No automated gate-approval claims",
				status: "pass",
				detail: `${files.length} prose files scanned across ${present.join(", ")}`,
				section: "Gates",
			},
		];
	}

	const detail = violations
		.map((v) => `${v.file}:${v.line} found "${v.found}" — expected "${v.expected}"`)
		.join("\n         ");

	return [
		{
			name: `Automated gate-approval claims (${violations.length})`,
			status: "fail",
			detail,
			section: "Gates",
		},
	];
}
