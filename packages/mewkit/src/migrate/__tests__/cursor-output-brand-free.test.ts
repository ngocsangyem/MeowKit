// Generated/authored Cursor surfaces must contain zero Claude/Anthropic/codex brand
// tokens — mirrors codex-output-brand-free.test.ts's intent, adapted to Cursor's
// hand-authored bundle: there is no converter output to scan (Cursor is not produced by
// the generic md-strip/direct-copy pipeline), so this scans the real authored artifacts
// that install into a user's project — AGENTS.md, .cursor/**, .cursor/skills/** — using
// the existing denylist helpers (scanDeniedTokens + scanCursorExtraDenied) instead of a
// new regex, per the phase's "reuse the existing denylist helpers" instruction. This
// overlaps cursor-bundle-lint.test.ts's denylist coverage by design (see task context) —
// that suite scopes to agents/rules/skills/AGENTS.md; this one additionally covers the
// hooks surface (hooks.json + .cjs handlers), which cursor-bundle-lint's denylistScope
// does not walk. `.meowkit/README.md` is deliberately NOT scanned here — it legitimately
// documents the real `.claude/memory/` -> `.meowkit/memory/` cross-provider import path
// (a factual interop reference, not a leaked instruction), matching
// cursor-bundle-lint.test.ts's own documented exclusion of that file.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCursorModuleDir } from "../modules/cursor-authored-bundle.js";
import { scanCursorDenied } from "../modules/cursor-extra-denied-tokens.js";

const moduleDir = resolveCursorModuleDir();
const rootDir = join(moduleDir, "root");

function walkFiles(dir: string, acc: string[] = []): string[] {
	if (!existsSync(dir)) return acc;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walkFiles(p, acc);
		else acc.push(p);
	}
	return acc;
}

describe("cursor output is brand-free", () => {
	it("AGENTS.md carries no Claude/Anthropic/codex brand or tool tokens", () => {
		const content = readFileSync(join(rootDir, "AGENTS.md"), "utf-8");
		expect(scanCursorDenied(content)).toEqual([]);
	});

	it("every .cursor/skills/** file is free of denied tokens", () => {
		const leaks: string[] = [];
		for (const file of walkFiles(join(rootDir, ".cursor", "skills"))) {
			const hits = scanCursorDenied(readFileSync(file, "utf-8"));
			if (hits.length > 0) leaks.push(`${file.slice(rootDir.length + 1)} [${hits.join(", ")}]`);
		}
		expect(leaks, `denied tokens found: ${leaks.join("; ")}`).toEqual([]);
	});

	it("every .cursor/** file (agents, rules, hooks, hooks.json) is free of denied tokens", () => {
		const leaks: string[] = [];
		for (const file of walkFiles(join(rootDir, ".cursor"))) {
			const hits = scanCursorDenied(readFileSync(file, "utf-8"));
			if (hits.length > 0) leaks.push(`${file.slice(rootDir.length + 1)} [${hits.join(", ")}]`);
		}
		expect(leaks, `denied tokens found: ${leaks.join("; ")}`).toEqual([]);
	});
});
