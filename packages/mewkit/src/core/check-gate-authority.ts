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
