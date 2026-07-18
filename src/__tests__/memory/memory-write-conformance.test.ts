// Conformance guard for MK-P1-04 (memory single-write path). A canonical-JSON store
// (fixes / review-patterns / architecture-decisions / security-findings) is written via its
// `.json`; the top-level `<store>.md` (incl. the legacy `security-notes.md`) is a
// legacy/generated view JSON-first readers ignore. So NO shipped skill/agent/command/rule may
// instruct an append/write/EDIT to a canonical store's `.md` view — a write there silently
// loses the entry (the split-brain this closes).
//
// Markdown-native stores (decisions.md, quick-notes.md, security-log.md) are exempt: they have
// no JSON and ARE canonical. The pattern targets write VERBS (append/write/edit/>>) at a
// canonical `.md`, and skips only lines that NEGATE the write or describe view/legacy/seed
// semantics — not any line that merely contains "canonical" (a real offender may too).
// Scans both `.claude/` (source) and `plugin/` (generated mirror) so drift can't hide one.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(process.cwd());
const SCAN_ROOTS = [".claude", "plugin"];
const SCAN_SUBDIRS = ["skills", "agents", "commands", "rules", "rules-conditional"];
const SCAN_DIRS = SCAN_ROOTS.flatMap((r) => SCAN_SUBDIRS.map((d) => path.join(REPO_ROOT, r, d)));

// Canonical-store view names (incl. the security-findings legacy alias security-notes.md).
const CANONICAL = "fixes|review-patterns|architecture-decisions|security-findings|security-notes";

// A write instruction aimed at a canonical store's .md view. `edit` included — Path 2's own tool.
const WRITE_TO_VIEW = new RegExp(
	`(append(ing)?\\s+(to|the)|writ(e|ing)\\s+to|edit(ing)?|>>\\s*\`?[.\\/]*)\\s*\`?[.\\/]*(\\.claude/)?memory/(${CANONICAL})\\.md`,
	"i",
);
// Excluded ONLY when the line negates the write or describes view/legacy/seed/fallback semantics.
// Deliberately does NOT exclude on bare "canonical"/"view"/"read" — an offender may use those.
const IS_DESCRIPTIVE = /\b(not|never|n't|do not|don't)\b|legacy|generated|non-authoritative|\bseed|views\/|read fallback|fall.?back|invisible/i;

function walk(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(p));
		else if (/\.(md|cjs|sh|ts|js)$/.test(entry.name)) out.push(p);
	}
	return out;
}

describe("memory single-write conformance (MK-P1-04)", () => {
	it("no shipped content instructs a write to a canonical-store .md view", () => {
		const offenders: string[] = [];
		for (const dir of SCAN_DIRS) {
			for (const file of walk(dir)) {
				fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
					if (WRITE_TO_VIEW.test(line) && !IS_DESCRIPTIVE.test(line)) {
						offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
					}
				});
			}
		}
		expect(offenders, `Write to a canonical-store .md view (use the .json — see memory-read-rules.md Write Rules):\n${offenders.join("\n")}`).toEqual([]);
	});

	it("the guard actually catches violations, incl. the Edit verb and a 'canonical'-labelled offender", () => {
		const caught = (s: string) => WRITE_TO_VIEW.test(s) && !IS_DESCRIPTIVE.test(s);
		// Real offenders — must be caught:
		expect(caught("Append to `.claude/memory/architecture-decisions.md`:")).toBe(true);
		expect(caught("Edit .claude/memory/fixes.md to add the pattern")).toBe(true);
		expect(caught("Append to `.claude/memory/security-notes.md` (the canonical security log)")).toBe(true);
		expect(caught(">> .claude/memory/review-patterns.md")).toBe(true);
		// Non-offenders — must NOT be caught:
		expect(caught("Append to `.claude/memory/quick-notes.md`")).toBe(false); // markdown-native
		expect(caught("append to `.claude/memory/security-log.md` (forensic trail)")).toBe(false); // markdown-native
		expect(caught("write the .json, NOT the `.md` view")).toBe(false); // negated
		expect(caught("Fall back to `.claude/memory/fixes.md` only when the JSON is absent")).toBe(false); // read fallback
	});
});
