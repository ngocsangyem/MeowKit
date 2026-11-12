// One projection, three entry points, and no second way in.
//
// The chokepoint is asserted two ways, because each alone is weak. Passages
// through the projection are RECORDED, so "this entry point goes through it" is
// observed rather than assumed; and no command module may call a per-target
// writer directly, so a future entry point cannot quietly add a second path that
// the recorder would never see.
//
// Comparing the commands' outputs would prove neither. Identical output is
// exactly what two independent writers look like, right up until the day one of
// them changes.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { emitterPassages, emitTarget, resetEmitterPassages } from "../emit-target.js";
import { emitCodexTarget, emitCursorTarget } from "../emit-bundle-target.js";
import { TARGET_SHAPES, canAddress, invocableCombinations } from "../target-shape.js";
import { resolveCodexModuleDir } from "../../migrate/modules/codex-authored-bundle.js";
import { resolveCursorModuleDir } from "../../migrate/modules/cursor-authored-bundle.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..");

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const temp = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "mewkit-one-emitter-"));
	roots.push(dir);
	return dir;
};

beforeEach(() => resetEmitterPassages());

describe("the invocable surface", () => {
	it("is eight combinations, because migrate cannot address the kit's own runtime", () => {
		const combinations = invocableCombinations();
		// Two for claude-code (`init`, `upgrade`); three each for codex and cursor,
		// which `migrate` exports to as EXTERNAL tools.
		expect(combinations).toHaveLength(8);
		expect(combinations.filter((c) => c.target === "claude-code").map((c) => c.entryPoint)).toEqual([
			"init",
			"upgrade",
		]);
		expect(canAddress("claude-code", "migrate")).toBe(false);
		for (const target of ["codex", "cursor"] as const) {
			expect(combinations.filter((c) => c.target === target).map((c) => c.entryPoint)).toEqual([
				"init",
				"upgrade",
				"migrate",
			]);
		}
	});

	it("declares one shape source per target, and one delivery choice in total", () => {
		expect(TARGET_SHAPES["claude-code"].deliveries).toEqual(["native", "plugin"]);
		for (const target of ["codex", "cursor"] as const) {
			expect(TARGET_SHAPES[target].deliveries).toEqual(["native"]);
		}
		// One source per target, so no target has two ways to be produced.
		for (const shape of Object.values(TARGET_SHAPES)) {
			expect(["release-kit", "authored-bundle"]).toContain(shape.source);
		}
	});
});

describe("every entry point goes through the projection", () => {
	it("records a passage for each entry point that can address an authored-bundle target", async () => {
		for (const target of ["codex", "cursor"] as const) {
			const moduleDir = target === "codex" ? resolveCodexModuleDir() : resolveCursorModuleDir();
			const emit = target === "codex" ? emitCodexTarget : emitCursorTarget;
			for (const entryPoint of TARGET_SHAPES[target].entryPoints) {
				// A plan-only run: the assertion is about the passage, not the writes.
				await emit(entryPoint, temp(), moduleDir, { dryRun: true });
			}
		}
		const seen = emitterPassages().map((p) => `${p.target}/${p.entryPoint}`);
		expect(seen).toEqual([
			"codex/init",
			"codex/upgrade",
			"codex/migrate",
			"cursor/init",
			"cursor/upgrade",
			"cursor/migrate",
		]);
	});

	it("records the delivery it was asked for, so the plugin envelope is not a separate path", async () => {
		const root = temp();
		mkdirSync(join(root, ".claude"), { recursive: true });
		// A release-kit emit with no release resolved is refused rather than
		// half-performed: the projection will not write a target's shape from
		// nothing, which is what makes the `release` field load-bearing.
		await expect(
			emitTarget({ target: "claude-code", delivery: "plugin", entryPoint: "init", projectRoot: root }),
		).rejects.toThrow(/needs an extracted release/);
		expect(emitterPassages()).toHaveLength(0);
	});

	it("refuses an authored-bundle emit with no bundle, rather than writing a partial target", async () => {
		await expect(
			emitTarget({ target: "codex", delivery: "native", entryPoint: "upgrade", projectRoot: temp() }),
		).rejects.toThrow(/needs its authored bundle/);
		expect(emitterPassages()).toHaveLength(0);
	});
});

describe("there is no second way in", () => {
	const commandModules = [
		join(SRC, "commands", "init.ts"),
		join(SRC, "commands", "upgrade.ts"),
	];

	it("leaves no command calling a per-target writer directly", () => {
		for (const file of commandModules) {
			const source = readFileSync(file, "utf8");
			for (const writer of [
				/reconcileApplyCodexBundle\s*\(/,
				/reconcileApplyCursorBundle\s*\(/,
				/\bsmartUpdate\s*\(/,
			]) {
				expect(source).not.toMatch(writer);
			}
		}
	});

	/**
	 * `pack add|remove` writes a SUBSET of an already-laid-down target rather than
	 * laying the target down, so it is not one of the three install entry points
	 * whose agreement this projection exists to guarantee. It is named here rather
	 * than matched by a loose pattern: an exception a reader can see is an
	 * exception someone can argue with, and a silent one is a second path.
	 */
	const NAMED_EXCEPTIONS = [join(SRC, "commands", "pack.ts")];

	it("leaves no module calling a per-target writer except the projection and the named exception", () => {
		const offenders: string[] = [];
		const walk = (dir: string): void => {
			for (const name of readdirSync(dir)) {
				const full = join(dir, name);
				if (name === "__tests__" || name === "node_modules") continue;
				if (statSync(full).isDirectory()) {
					walk(full);
					continue;
				}
				if (!name.endsWith(".ts")) continue;
				if (full === join(SRC, "emit", "emit-target.ts")) continue;
				// The writers' own modules define them.
				if (full.endsWith("codex-reconcile-apply.ts") || full.endsWith("cursor-reconcile-apply.ts")) continue;
				if (full.endsWith(join("core", "smart-update.ts")) || full.endsWith(join("core", "index.ts"))) continue;
				if (NAMED_EXCEPTIONS.includes(full)) continue;
				const source = readFileSync(full, "utf8");
				if (/reconcileApply(?:Codex|Cursor)Bundle\s*\(|\bsmartUpdate\s*\(/.test(source)) offenders.push(full);
			}
		};
		walk(SRC);
		expect(offenders).toEqual([]);
	});

	it("keeps the plugin envelope inside the projection rather than beside it", () => {
		// `--delivery plugin` and `--delivery native` must come out of one emitter.
		// A second caller of the envelope writer would be the parallel path that
		// lets the two drift.
		const projection = readFileSync(join(SRC, "emit", "emit-target.ts"), "utf8");
		expect(projection).toMatch(/emitPluginDelivery\(/);
		const runInstall = readFileSync(join(SRC, "commands", "run-install.ts"), "utf8");
		expect(runInstall).not.toMatch(/emitPluginDelivery\(/);
	});
});

/** Keeps the temp-root helper honest: a dry run must still write nothing. */
it("writes nothing on a dry run", async () => {
	const root = temp();
	await emitCodexTarget("init", root, resolveCodexModuleDir(), { dryRun: true });
	writeFileSync(join(root, "marker"), "x");
	expect(readFileSync(join(root, "marker"), "utf8")).toBe("x");
});
