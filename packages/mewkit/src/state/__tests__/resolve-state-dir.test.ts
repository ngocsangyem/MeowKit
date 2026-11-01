// The state-root fallback decides where every writer puts a user's data, so it is tested
// against the four project shapes it must distinguish, and against its two twins in
// .claude/hooks/lib/ — a divergence between the three implementations is a split-brain that
// writes history to one tree and reads it from another.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveStateDir, usingLegacyMemoryTree } from "../resolve-state-dir.js";

const HOOK_LIB = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"..",
	"..",
	".claude",
	"hooks",
	"lib",
);

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

type Shape = "fresh" | "legacy" | "migrated" | "legacy-gitkeep" | "legacy-stray-file" | "meowkit-no-memory";

function makeRoot(shape: Shape): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-stateroot-"));
	roots.push(root);
	if (shape === "legacy" || shape === "migrated") {
		// A RECOGNISED store file is what makes the legacy tree a memory store.
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", "gotchas.md"), "# Gotchas\n");
	}
	if (shape === "legacy-stray-file") {
		// A log, a cache file, a botched redirect — several writers mkdir -p this path. One
		// stray entry must NOT relocate (and thereby un-commit) the whole store.
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", "docs-cache.json"), "{}");
	}
	if (shape === "legacy-gitkeep") {
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", ".gitkeep"), "");
	}
	if (shape === "migrated") mkdirSync(join(root, ".meowkit", "memory"), { recursive: true });
	// A codex/cursor ledger materializes `.meowkit/state/` without any memory migration.
	if (shape === "meowkit-no-memory") mkdirSync(join(root, ".meowkit", "state"), { recursive: true });
	return root;
}

describe("resolveStateDir — project shapes", () => {
	it("a fresh project uses the taxonomy for every class", () => {
		const root = makeRoot("fresh");
		expect(usingLegacyMemoryTree(root)).toBe(false);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".meowkit", "memory"));
		expect(resolveStateDir(root, "telemetry")).toBe(join(root, ".meowkit", "telemetry"));
		expect(resolveStateDir(root, "state")).toBe(join(root, ".meowkit", "state"));
		expect(resolveStateDir(root, "cache")).toBe(join(root, ".meowkit", "cache"));
	});

	it("a pre-migration project keeps writing its MEMORY to the existing tree, so history is never split", () => {
		const root = makeRoot("legacy");
		expect(usingLegacyMemoryTree(root)).toBe(true);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".claude", "memory"));
	});

	it("the legacy fallback is scoped to memory — telemetry, state and cache never follow it", () => {
		// The fallback used to apply to all four classes, which put the trace log and the
		// security log INSIDE the grep-read memory directory, and resolved the committed store
		// into a gitignored path. Only `memory` has legacy history to preserve.
		const root = makeRoot("legacy");
		for (const cls of ["telemetry", "state", "cache"] as const) {
			expect(resolveStateDir(root, cls)).toBe(join(root, ".meowkit", cls));
		}
	});

	it("one stray non-store file in the legacy dir does not flip the fallback", () => {
		const root = makeRoot("legacy-stray-file");
		expect(usingLegacyMemoryTree(root)).toBe(false);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".meowkit", "memory"));
	});

	it("a migrated project ignores leftover legacy content", () => {
		const root = makeRoot("migrated");
		expect(usingLegacyMemoryTree(root)).toBe(false);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".meowkit", "memory"));
	});

	it("a legacy dir holding only .gitkeep is not real content", () => {
		const root = makeRoot("legacy-gitkeep");
		expect(usingLegacyMemoryTree(root)).toBe(false);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".meowkit", "memory"));
	});

	it("a ledger-only .meowkit/ does not by itself claim the project is migrated", () => {
		// `.meowkit/state/` exists (codex ledger) but memory never moved, and there is no legacy
		// content either — the taxonomy is still correct, and the predicate keys off memory alone.
		const root = makeRoot("meowkit-no-memory");
		expect(usingLegacyMemoryTree(root)).toBe(false);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".meowkit", "memory"));
	});

	it("a ledger-only .meowkit/ alongside real legacy content still defers to the legacy tree", () => {
		const root = makeRoot("meowkit-no-memory");
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", "decisions.md"), "# Decisions\n");
		expect(usingLegacyMemoryTree(root)).toBe(true);
		expect(resolveStateDir(root, "memory")).toBe(join(root, ".claude", "memory"));
	});
});

describe("the three resolvers agree", () => {
	// `legacy` is excluded from the all-class sweep: only `memory` follows the legacy tree,
	// covered by the dedicated tests below.
	const shapes = ["fresh", "migrated", "legacy-gitkeep", "meowkit-no-memory"] as const;
	const classes = ["memory", "telemetry", "state", "cache"] as const;

	function shellResolve(root: string, cls: string): string {
		return execFileSync("bash", ["-c", `. "${join(HOOK_LIB, "meowkit-paths.sh")}"; meowkit_state_dir ${cls}`], {
			env: { ...process.env, CLAUDE_PROJECT_DIR: root },
			encoding: "utf-8",
		}).trim();
	}

	function cjsResolve(root: string, cls: string): string {
		return execFileSync(
			"node",
			[
				"-e",
				`process.stdout.write(require(${JSON.stringify(join(HOOK_LIB, "meowkit-paths.cjs"))}).stateDir(${JSON.stringify(cls)}, ${JSON.stringify(root)}))`,
			],
			{ encoding: "utf-8" },
		).trim();
	}

	for (const shape of shapes) {
		it(`TypeScript, shell, and cjs resolve identically for a ${shape} project`, () => {
			const root = makeRoot(shape);
			for (const cls of classes) {
				const ts = resolveStateDir(root, cls);
				expect(shellResolve(root, cls), `shell disagrees on ${cls}`).toBe(ts);
				expect(cjsResolve(root, cls), `cjs disagrees on ${cls}`).toBe(ts);
			}
		});
	}

	it("all three still agree on MEMORY for a legacy project", () => {
		const root = makeRoot("legacy");
		const ts = resolveStateDir(root, "memory");
		expect(ts).toBe(join(root, ".claude", "memory"));
		expect(shellResolve(root, "memory")).toBe(ts);
		expect(cjsResolve(root, "memory")).toBe(ts);
	});

	it("all three agree that telemetry/state/cache never fall back, and a stray file does not flip memory", () => {
		const legacy = makeRoot("legacy");
		for (const cls of ["telemetry", "state", "cache"] as const) {
			const ts = resolveStateDir(legacy, cls);
			expect(ts).toBe(join(legacy, ".meowkit", cls));
			expect(shellResolve(legacy, cls)).toBe(ts);
			expect(cjsResolve(legacy, cls)).toBe(ts);
		}
		const stray = makeRoot("legacy-stray-file");
		const ts = resolveStateDir(stray, "memory");
		expect(ts).toBe(join(stray, ".meowkit", "memory"));
		expect(shellResolve(stray, "memory")).toBe(ts);
		expect(cjsResolve(stray, "memory")).toBe(ts);
	});
});
