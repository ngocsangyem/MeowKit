// The legacy-memory import must survive the phase-9 porter deletion: nothing on its
// import path may reference modules/porter/**. This walks the static import closure from
// the memory-import entry points and fails if any resolved module lives under the porter
// tree — a guard so a future edit cannot quietly re-couple the two.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const preflightDir = resolve(here, ".."); // src/migrate/memory-preflight

// Entry points that define the memory-import path (NOT commands/migrate.ts, whose migrate
// orchestrator legitimately touches the porter — the guard is scoped to the import logic).
const ENTRY_POINTS = [
	join(preflightDir, "memory-preflight.ts"),
	join(preflightDir, "memory-migration-transaction.ts"),
];

const IMPORT_RE = /(?:import|export)\s+(?:[^"']*?\sfrom\s+)?["'](\.[^"']+)["']/g;

/** Resolve a relative import specifier (with a `.js` runtime extension) to its `.ts` source. */
function resolveSource(fromFile: string, spec: string): string | null {
	const base = resolve(dirname(fromFile), spec);
	const candidates = [
		base.replace(/\.js$/, ".ts"),
		base.endsWith(".ts") ? base : `${base}.ts`,
		join(base, "index.ts"),
	];
	return candidates.find((c) => existsSync(c)) ?? null;
}

function buildClosure(entries: string[]): Set<string> {
	const seen = new Set<string>();
	const stack = [...entries];
	while (stack.length > 0) {
		const file = stack.pop()!;
		if (seen.has(file) || !existsSync(file)) continue;
		seen.add(file);
		const src = readFileSync(file, "utf-8");
		for (const m of src.matchAll(IMPORT_RE)) {
			const resolved = resolveSource(file, m[1]);
			if (resolved && !seen.has(resolved)) stack.push(resolved);
		}
	}
	return seen;
}

describe("porter independence of the memory-import path", () => {
	it("import closure contains no module under modules/porter/", () => {
		const closure = buildClosure(ENTRY_POINTS);
		const offenders = [...closure].filter((f) => f.replace(/\\/g, "/").includes("/modules/porter/"));
		expect(offenders).toEqual([]);
	});

	it("no source on the path references a porter specifier", () => {
		const closure = buildClosure(ENTRY_POINTS);
		const referencing = [...closure].filter((f) => /porter/i.test(readFileSync(f, "utf-8")));
		expect(referencing).toEqual([]);
	});

	it("the closure is non-trivial (walker actually traversed imports)", () => {
		const closure = buildClosure(ENTRY_POINTS);
		expect(closure.size).toBeGreaterThan(3);
	});
});
