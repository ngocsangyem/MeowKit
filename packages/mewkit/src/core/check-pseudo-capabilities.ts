// Projection-time rejection of UNRESOLVED PSEUDO-CAPABILITY ALIASES.
//
// The defect class: a skill's prose names a logical operation in a template form
// that was never substituted — literal text like "use `manage_plan capability`"
// or "delegate_agent capability" — instead of naming the real host primitive.
//
// Why it must fail the BUILD rather than warn: the string reads as if it means
// something. An agent following that prose looks for a "manage_plan capability",
// finds nothing, and improvises — which is the failure the operation table exists
// to prevent. It is a broken instruction that is indistinguishable from a working
// one until an agent acts on it, so the only safe time to catch it is before the
// payload ships.
//
// Scope is deliberately narrow: the four logical operation names, immediately
// followed by the word "capability". That phrase has no legitimate use — the
// operations are adapter-internal (see provider-operations.ts) and are never a
// "capability" in the manifest sense, so any occurrence is an unsubstituted
// placeholder. A broader "looks like a dangling reference" check was evaluated and
// rejected: every candidate it flagged in this tree was legitimate prose, and a
// build gate that only ever cries wolf gets switched off.
import fs from "node:fs";
import path from "node:path";
import { LOGICAL_OPERATIONS } from "./provider-operations.js";

export interface PseudoCapabilityFinding {
	file: string; // relative to the scanned root
	line: number; // 1-based
	found: string;
}

/** Suppression marker for prose that must quote the anti-pattern (e.g. this rule's own docs). */
const ALLOW_MARKER = "lint-allow-pseudo-capability";

/**
 * `<operation> capability` — an unsubstituted placeholder. Built from the operation
 * list so the two cannot drift: a new operation is covered the day it is added.
 */
function pseudoCapabilityRe(): RegExp {
	return new RegExp(`\\b(${LOGICAL_OPERATIONS.join("|")})\\s+capability\\b`, "gi");
}

/** Scan one file's prose for unresolved pseudo-capability aliases. */
export function scanForPseudoCapabilities(root: string, relPath: string): PseudoCapabilityFinding[] {
	const abs = path.join(root, relPath);
	if (!fs.existsSync(abs)) return [];

	const findings: PseudoCapabilityFinding[] = [];
	const re = pseudoCapabilityRe();

	fs.readFileSync(abs, "utf-8")
		.split("\n")
		.forEach((text, idx) => {
			if (text.includes(ALLOW_MARKER)) return;
			re.lastIndex = 0;
			const m = re.exec(text);
			if (m) findings.push({ file: relPath, line: idx + 1, found: m[0] });
		});

	return findings;
}

/** Every prose file under `dir`, relative to `root`. */
function collectProse(root: string, dir: string, acc: string[] = []): string[] {
	const abs = path.join(root, dir);
	if (!fs.existsSync(abs)) return acc;
	for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".git")) continue;
			collectProse(root, rel, acc);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			acc.push(rel);
		}
	}
	return acc;
}

/**
 * Scan a projected tree. Returns every finding; the caller decides severity —
 * a plugin build step throws, `validate` reports.
 */
export function findPseudoCapabilities(root: string, scanDirs: string[] = ["."]): PseudoCapabilityFinding[] {
	return scanDirs.flatMap((dir) => collectProse(root, dir)).flatMap((rel) => scanForPseudoCapabilities(root, rel));
}

/** Render findings as a build-failure message with file:line locations. */
export function formatPseudoCapabilityError(findings: PseudoCapabilityFinding[]): string {
	const lines = findings.map((f) => `  ${f.file}:${f.line}  "${f.found}"`);
	return [
		`Unresolved pseudo-capability alias in ${findings.length} place(s):`,
		...lines,
		"",
		"These are unsubstituted placeholders, not real capabilities. An agent that reads",
		"one will look for something that does not exist and improvise. Name the actual",
		"host primitive instead (see packages/mewkit/src/core/provider-operations.ts).",
	].join("\n");
}
