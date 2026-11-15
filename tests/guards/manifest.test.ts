// Guard case manifest: every guardCase/expectedFail declared in tests/guards/*.guards.test.ts
// must be listed in manifest.json, with matching totals. Removing or renaming a case without
// editing the manifest (and saying why in its `removed` list) fails here.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

interface Manifest {
	counts: { guard: number; expectedFail: number };
	guard: string[];
	expectedFail: { id: string; fixedBy: string }[];
	removed: { id: string; reason: string }[];
}

const DIR = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8")) as Manifest;

/** Expand a case id that interpolates one loop variable over the array literal it iterates. */
function declaredCases(): { guard: string[]; expectedFail: string[] } {
	const out = { guard: [] as string[], expectedFail: [] as string[] };
	for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".guards.test.ts"))) {
		const src = fs.readFileSync(path.join(DIR, file), "utf8");
		const loops = [...src.matchAll(/for \(const (\w+) of (\[[^\]]*\]|SHIP_EVASIONS)\)/g)];
		for (const m of src.matchAll(/(guardCase|expectedFail)\(\s*(["`])((?:(?!\2).)*)\2/g)) {
			const [, kind, , raw] = m;
			let ids = [raw];
			const varMatch = raw.match(/\$\{(\w+)\}/);
			if (varMatch) {
				const loop = loops.find((l) => l[1] === varMatch[1]);
				const values = loop ? listValues(loop[2]) : [];
				ids = values.map((v) => raw.replace(`\${${varMatch[1]}}`, v));
			}
			out[kind === "guardCase" ? "guard" : "expectedFail"].push(...ids);
		}
	}
	return out;
}

function listValues(literal: string): string[] {
	if (literal === "SHIP_EVASIONS") {
		const src = fs.readFileSync(path.join(DIR, "cases.ts"), "utf8");
		literal = src.match(/SHIP_EVASIONS = (\[[^\]]*\])/)![1];
	}
	return [...literal.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

describe("guard case manifest", () => {
	const declared = declaredCases();

	test("totals match the manifest", () => {
		expect(declared.guard.length).toBe(manifest.counts.guard);
		expect(declared.expectedFail.length).toBe(manifest.counts.expectedFail);
	});

	test("every declared case is listed, and every listed case is declared", () => {
		expect([...declared.guard].sort()).toEqual([...manifest.guard].sort());
		expect([...declared.expectedFail].sort()).toEqual(manifest.expectedFail.map((c) => c.id).sort());
	});

	test("every expected-fail case names the phase that fixes it", () => {
		for (const c of manifest.expectedFail) expect(c.fixedBy).toMatch(/^phase-\d$/);
	});
});
