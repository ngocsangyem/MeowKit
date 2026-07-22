import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMemoryPreflight } from "../memory-preflight.js";
import { renderPreflightReport, preflightExitCode, preflightToJson } from "../memory-preflight-report.js";
import { buildFixture, type FixtureName } from "./memory-preflight-fixtures.js";
import type { InventoryEntry } from "../preflight-types.js";

let root: string;

beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "meowkit-preflight-")));
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const byRel = (inv: InventoryEntry[], rel: string): InventoryEntry | undefined => inv.find((e) => e.relPath === rel);

describe("runMemoryPreflight — scenarios", () => {
	it("empty project → noop, empty inventory", async () => {
		buildFixture("empty", root);
		const r = await runMemoryPreflight(root);
		expect(r.inventory).toEqual([]);
		expect(r.noop).toBe(true);
	});

	it("target-only (already migrated, no legacy) → noop", async () => {
		buildFixture("target-only", root);
		const r = await runMemoryPreflight(root);
		expect(r.noop).toBe(true);
		expect(r.inventory).toEqual([]);
	});

	it("legacy-only → each file staged into its taxonomy class; deterministic order", async () => {
		buildFixture("legacy-only", root);
		const r = await runMemoryPreflight(root);
		expect(r.noop).toBe(false);
		// Stable sort by relPath.
		expect(r.inventory.map((e) => e.relPath)).toEqual(
			[...r.inventory.map((e) => e.relPath)].sort((a, b) => a.localeCompare(b)),
		);
		expect(byRel(r.inventory, "fixes.json")).toMatchObject({ targetRelPath: "memory/fixes.json", action: "stage" });
		expect(byRel(r.inventory, "cost-log.json")?.targetClass).toBe("telemetry");
		expect(byRel(r.inventory, "last-model-id.txt")?.targetClass).toBe("state");
		expect(byRel(r.inventory, "wiki-index.db")?.targetClass).toBe("cache");
		expect(byRel(r.inventory, "random-note.txt")?.targetRelPath).toBe("memory/legacy/random-note.txt");
		// .gitkeep retained, never staged.
		expect(byRel(r.inventory, ".gitkeep")).toMatchObject({ targetClass: "retain", action: "skip" });
	});

	it("identical legacy+target → all noop", async () => {
		buildFixture("identical", root);
		const r = await runMemoryPreflight(root);
		expect(byRel(r.inventory, "fixes.json")?.action).toBe("noop");
		expect(r.noop).toBe(true);
	});

	it("conflicting content → conflict, never overwrite, noop=false", async () => {
		buildFixture("conflicting", root);
		const r = await runMemoryPreflight(root);
		expect(byRel(r.inventory, "fixes.json")?.action).toBe("conflict");
		expect(r.conflicts).toHaveLength(1);
		expect(r.noop).toBe(false);
	});

	it("mixed taxonomy → correct class per file", async () => {
		buildFixture("mixed-taxonomy", root);
		const r = await runMemoryPreflight(root);
		expect(byRel(r.inventory, "fixes.json")?.targetClass).toBe("memory");
		expect(byRel(r.inventory, "cost-log.json")?.targetClass).toBe("telemetry");
		expect(byRel(r.inventory, "last-model-id.txt")?.targetClass).toBe("state");
		expect(byRel(r.inventory, "wiki-index.db")?.targetClass).toBe("cache");
		expect(byRel(r.inventory, "weird.dat")?.targetRelPath).toBe("memory/legacy/weird.dat");
		expect(byRel(r.inventory, "views/fixes.md")?.targetRelPath).toBe("memory/views/fixes.md");
	});
});

describe("safety invariants", () => {
	it("corrupt curated JSON → quarantined to memory/legacy/, never published", async () => {
		buildFixture("corrupt-json", root);
		const r = await runMemoryPreflight(root);
		const e = byRel(r.inventory, "fixes.json")!;
		expect(e.validationState).toBe("invalid");
		expect(e.action).toBe("quarantine");
		expect(e.targetRelPath).toBe("memory/legacy/fixes.json");
	});

	it("symlink is recorded but never followed or staged", async () => {
		buildFixture("symlink-escape", root);
		const r = await runMemoryPreflight(root);
		const link = byRel(r.inventory, "escape-link.json")!;
		expect(link.validationState).toBe("symlink");
		expect(link.action).toBe("skip");
		expect(link.checksum).toBeNull();
		// The outside secret's content must never appear in the plan.
		expect(JSON.stringify(r)).not.toContain("SHOULD NEVER BE STAGED");
		// It is not counted as a staging action.
		expect(r.actions.some((a) => a.relPath === "escape-link.json")).toBe(false);
	});

	it("unknown nested files preserved under memory/legacy/<relPath>", async () => {
		buildFixture("unknown-files", root);
		const r = await runMemoryPreflight(root);
		expect(byRel(r.inventory, "notes/scratch.txt")?.targetRelPath).toBe("memory/legacy/notes/scratch.txt");
		expect(byRel(r.inventory, "mystery.dat")?.action).toBe("stage");
	});
});

describe("dry-run purity", () => {
	function snapshot(dir: string): string[] {
		const out: string[] = [];
		const walk = (d: string, rel: string) => {
			for (const name of readdirSync(d).sort()) {
				const abs = join(d, name);
				const st = statSync(abs);
				if (st.isDirectory()) walk(abs, `${rel}${name}/`);
				else out.push(`${rel}${name}:${st.size}:${readFileSync(abs, "utf-8")}`);
			}
		};
		walk(dir, "");
		return out;
	}

	it("preflight over mixed-taxonomy performs zero filesystem mutations", async () => {
		buildFixture("mixed-taxonomy", root);
		const before = snapshot(root);
		await runMemoryPreflight(root);
		expect(snapshot(root)).toEqual(before);
	});
});

describe("report + exit code", () => {
	it("clean plan → exit 0; conflicting plan → exit 2", async () => {
		buildFixture("legacy-only", root);
		expect(preflightExitCode(await runMemoryPreflight(root))).toBe(0);
		const conflictRoot = realpathSync(mkdtempSync(join(tmpdir(), "meowkit-preflight-c-")));
		buildFixture("conflicting", conflictRoot);
		expect(preflightExitCode(await runMemoryPreflight(conflictRoot))).toBe(2);
		rmSync(conflictRoot, { recursive: true, force: true });
	});

	it("renders a human report and a stable JSON projection", async () => {
		buildFixture("legacy-only", root);
		const r = await runMemoryPreflight(root);
		const text = renderPreflightReport(r);
		expect(text).toContain(".claude/memory/ → .meowkit/");
		const json = preflightToJson(r) as { counts: { total: number }; noop: boolean };
		expect(json.noop).toBe(false);
		expect(json.counts.total).toBe(r.inventory.length);
	});

	it("noop project renders an 'already migrated / nothing to do' summary", async () => {
		buildFixture("identical", root);
		const r = await runMemoryPreflight(root);
		expect(renderPreflightReport(r).toLowerCase()).toContain("nothing to do");
	});
});
