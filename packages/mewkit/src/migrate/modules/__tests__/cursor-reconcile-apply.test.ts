import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconcileApplyCursorBundle } from "../cursor-reconcile-apply.js";
import { meowkitStatePaths } from "../../../state/meowkit-state-paths.js";

// Integration coverage for the authored Cursor bundle's reconcile-backed apply. The pure
// reconcile decision matrix (`decideCodexEntryAction`) is exhaustively unit-tested in
// codex-reconcile-apply.test.ts and imported UNCHANGED here — re-testing it per-provider
// would be a phantom duplicate. These tests instead cover what's actually
// cursor-provider-specific: the project-local cursor-ledger.json, and the atomic-write +
// per-entry-ledger-flush hardening (crash-recovery self-heal).

function makeModule(dir: string): void {
	mkdirSync(join(dir, "root"), { recursive: true });
	writeFileSync(join(dir, "root", "AGENTS.md"), "# authored cursor agents\n");
	mkdirSync(join(dir, "root", ".meowkit"), { recursive: true });
	writeFileSync(join(dir, "root", ".meowkit", "README.md"), "# meowkit state\n");
	const manifest = {
		version: "1.0",
		provider: "cursor",
		generatedFrom: "test",
		entries: [
			{
				sourcePath: "root/AGENTS.md",
				targetPath: "AGENTS.md",
				provider: "cursor",
				mode: "0644",
				ownership: "managed-replace",
				scopeTags: ["managed-runtime"],
				active: true,
			},
			{
				sourcePath: "root/.meowkit/README.md",
				targetPath: ".meowkit/README.md",
				provider: "cursor",
				mode: "0644",
				ownership: "managed-replace",
				scopeTags: ["managed-runtime"],
				active: true,
			},
		],
	};
	writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

describe("reconcileApplyCursorBundle (integration)", () => {
	let moduleDir: string;
	let target: string;
	const opts = { adoptHomeRegistry: false as const };

	beforeEach(() => {
		moduleDir = mkdtempSync(join(tmpdir(), "cursor-mod-"));
		target = mkdtempSync(join(tmpdir(), "cursor-tgt-"));
		makeModule(moduleDir);
	});
	afterEach(() => {
		rmSync(moduleDir, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("installs on a fresh target and creates the project cursor ledger (distinct from codex's)", async () => {
		const r = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(r.writes).toBe(2);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(target, ".meowkit", "README.md"))).toBe(true);
		const paths = meowkitStatePaths(join(target, ".meowkit"));
		expect(existsSync(paths.cursorLedger)).toBe(true);
		expect(paths.cursorLedger.endsWith("cursor-ledger.json")).toBe(true);
		expect(existsSync(paths.codexLedger)).toBe(false);
		const ledger = JSON.parse(readFileSync(paths.cursorLedger, "utf-8"));
		expect(ledger.installations.every((i: { provider: string }) => i.provider === "cursor")).toBe(true);
	});

	it("is idempotent: a second run writes nothing", async () => {
		await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		const second = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(second.writes).toBe(0);
		expect(second.entries.every((e) => e.action === "skip" && e.reasonCode === "no-changes")).toBe(true);
	});

	it("dry-run writes no files and no ledger, but reports the plan", async () => {
		const r = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target, dryRun: true });
		expect(r.dryRun).toBe(true);
		expect(r.entries.filter((e) => e.action === "install").length).toBe(2);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(target, ".meowkit"))).toBe(false);
	});

	it("preserves a user edit on re-run, and overwrites it only with --force", async () => {
		await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		writeFileSync(join(target, "AGENTS.md"), "# MY EDIT\n");

		const preserve = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		const agents = preserve.entries.find((e) => e.targetPath === "AGENTS.md");
		expect(agents).toMatchObject({ action: "skip", reasonCode: "user-edits-preserved" });
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toBe("# MY EDIT\n");

		const forced = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target, force: true });
		expect(forced.entries.find((e) => e.targetPath === "AGENTS.md")?.wrote).toBe(true);
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toBe("# authored cursor agents\n");
	});

	it("adoption-as-conflict: a pre-existing differing target (no ledger) conflicts, never overwritten", async () => {
		writeFileSync(join(target, "AGENTS.md"), "# pre-existing user content\n");
		const r = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		const agents = r.entries.find((e) => e.targetPath === "AGENTS.md");
		expect(agents).toMatchObject({ action: "conflict" });
		expect(r.conflicts.map((c) => c.targetPath)).toContain("AGENTS.md");
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toBe("# pre-existing user content\n");
		// The other (fresh) entry still installs.
		expect(existsSync(join(target, ".meowkit", "README.md"))).toBe(true);
	});

	it("adoption: a pre-existing target identical to the source is adopted silently, then idempotent", async () => {
		mkdirSync(join(target, ".meowkit"), { recursive: true });
		writeFileSync(join(target, "AGENTS.md"), "# authored cursor agents\n");
		writeFileSync(join(target, ".meowkit", "README.md"), "# meowkit state\n");
		const r = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(r.writes).toBe(0);
		expect(r.conflicts).toHaveLength(0);
		const second = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(second.writes).toBe(0);
	});

	it("two projects are isolated: an edit in one never affects the other's reconcile", async () => {
		const targetB = mkdtempSync(join(tmpdir(), "cursor-tgtB-"));
		try {
			await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
			await reconcileApplyCursorBundle(moduleDir, targetB, { ...opts, projectRoot: targetB });
			writeFileSync(join(target, "AGENTS.md"), "# edit in A only\n");

			const a = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
			const b = await reconcileApplyCursorBundle(moduleDir, targetB, { ...opts, projectRoot: targetB });
			expect(a.entries.find((e) => e.targetPath === "AGENTS.md")).toMatchObject({ reasonCode: "user-edits-preserved" });
			expect(b.writes).toBe(0);
			expect(b.entries.every((e) => e.reasonCode === "no-changes")).toBe(true);
		} finally {
			rmSync(targetB, { recursive: true, force: true });
		}
	});
});

describe("reconcileApplyCursorBundle — crash-recovery re-run (atomic write + per-entry ledger flush)", () => {
	let moduleDir: string;
	let target: string;
	const opts = { adoptHomeRegistry: false as const };

	beforeEach(() => {
		moduleDir = mkdtempSync(join(tmpdir(), "cursor-crash-mod-"));
		target = mkdtempSync(join(tmpdir(), "cursor-crash-tgt-"));
		makeModule(moduleDir);
	});
	afterEach(() => {
		rmSync(moduleDir, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("self-heals when a write completed but the ledger flush for that entry never happened", async () => {
		// Simulate: entry A (AGENTS.md) installed + ledgered normally on a prior run that only
		// knew about A. Then entry B's (.meowkit/README.md) file content is written directly —
		// exactly what a completed `copyOneAtomic` rename leaves behind — WITHOUT recording its
		// ledger row, reproducing "the process died between the atomic write and the ledger
		// flush for that entry".
		const aOnlyModuleDir = mkdtempSync(join(tmpdir(), "cursor-crash-a-only-"));
		mkdirSync(join(aOnlyModuleDir, "root"), { recursive: true });
		writeFileSync(join(aOnlyModuleDir, "root", "AGENTS.md"), "# authored cursor agents\n");
		writeFileSync(
			join(aOnlyModuleDir, "manifest.json"),
			JSON.stringify({
				version: "1.0",
				provider: "cursor",
				generatedFrom: "test",
				entries: [
					{
						sourcePath: "root/AGENTS.md",
						targetPath: "AGENTS.md",
						provider: "cursor",
						mode: "0644",
						ownership: "managed-replace",
						scopeTags: ["managed-runtime"],
						active: true,
					},
				],
			}),
		);
		try {
			const first = await reconcileApplyCursorBundle(aOnlyModuleDir, target, { ...opts, projectRoot: target });
			expect(first.writes).toBe(1);
		} finally {
			rmSync(aOnlyModuleDir, { recursive: true, force: true });
		}

		// Now reproduce entry B's post-crash state: content fully written (atomic rename
		// already completed, byte-identical to the authored source), but no ledger row yet.
		mkdirSync(join(target, ".meowkit"), { recursive: true });
		writeFileSync(join(target, ".meowkit", "README.md"), "# meowkit state\n");
		const ledgerPath = meowkitStatePaths(join(target, ".meowkit")).cursorLedger;
		expect(existsSync(ledgerPath)).toBe(true);
		const ledgerBefore = JSON.parse(readFileSync(ledgerPath, "utf-8"));
		expect(ledgerBefore.installations).toHaveLength(1); // only AGENTS.md so far

		// No stray staging files should be left in the target directory by a clean run.
		const stray = readdirSync(target).filter((f) => f.includes("mewkit-tmp"));
		expect(stray).toHaveLength(0);

		// Re-run with the FULL two-entry manifest: AGENTS.md is already installed + ledgered
		// (no-op); README.md's content already matches the source with no ledger baseline, so
		// it is adopted (backfilled into the ledger) — NOT rewritten, and NEVER reported as a
		// conflict. This is the self-heal: the interrupted entry's ledger catches up without
		// re-doing the write or producing a permanent false conflict.
		const rerun = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(rerun.conflicts).toHaveLength(0);
		const readme = rerun.entries.find((e) => e.targetPath === ".meowkit/README.md");
		expect(readme).toMatchObject({ action: "skip", reasonCode: "target-up-to-date-backfill", wrote: false });
		const agents = rerun.entries.find((e) => e.targetPath === "AGENTS.md");
		expect(agents).toMatchObject({ action: "skip", reasonCode: "no-changes", wrote: false });

		const ledgerAfter = JSON.parse(readFileSync(ledgerPath, "utf-8"));
		expect(ledgerAfter.installations).toHaveLength(2);

		// Fully healed: the next run is completely idempotent.
		const stable = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(stable.writes).toBe(0);
		expect(stable.conflicts).toHaveLength(0);
		expect(stable.entries.every((e) => e.reasonCode === "no-changes")).toBe(true);
	});

	it("a crash BEFORE the atomic rename leaves no partial target — the next run installs cleanly", async () => {
		// Nothing was ever written to `target` (the crash happened while staging, before
		// `renameSync` swapped the staged content into place) — so `target` is exactly as if
		// no install had been attempted. A leftover stray staging file (same directory, unique
		// pid+timestamp name) does not collide with a fresh run.
		mkdirSync(join(target, ".meowkit"), { recursive: true });
		writeFileSync(join(target, ".meowkit", ".mewkit-tmp-README.md-99999-123"), "# incomplete\n");

		const r = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(r.writes).toBe(2);
		expect(r.conflicts).toHaveLength(0);
		expect(readFileSync(join(target, ".meowkit", "README.md"), "utf-8")).toBe("# meowkit state\n");

		const second = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(second.writes).toBe(0);
		expect(second.conflicts).toHaveLength(0);
	});
});

/**
 * A pack-enabled Cursor module whose skills tree contains exactly `skills`. Pack expansion
 * gives each installed skill its own ledger row — the provenance the retired-skill cleanup
 * reasons over. Cursor-specific here: the `.cursor/skills` root and the per-row ledger flush.
 */
function makeCursorPackModule(dir: string, skills: string[]): void {
	rmSync(join(dir, "root", ".cursor", "skills"), { recursive: true, force: true });
	for (const s of skills) {
		mkdirSync(join(dir, "root", ".cursor", "skills", s), { recursive: true });
		writeFileSync(join(dir, "root", ".cursor", "skills", s, "SKILL.md"), `# ${s}\n`);
	}
	mkdirSync(join(dir, "catalog"), { recursive: true });
	writeFileSync(
		join(dir, "catalog", "skill-packs.json"),
		JSON.stringify({
			budgetChars: 8000,
			defaultPack: "development",
			packs: { development: { description: "dev", dependsOn: [], skills } },
		}),
	);
	writeFileSync(
		join(dir, "manifest.json"),
		JSON.stringify({
			version: "1.0",
			provider: "cursor",
			generatedFrom: "test",
			entries: [
				{
					sourcePath: "root/.cursor/skills",
					targetPath: ".cursor/skills",
					provider: "cursor",
					mode: "0644",
					ownership: "managed-replace",
					scopeTags: ["managed-runtime"],
					active: true,
				},
			],
		}),
	);
}

describe("reconcileApplyCursorBundle — retired skill cleanup on upgrade", () => {
	let moduleDir: string;
	let target: string;
	const opts = { adoptHomeRegistry: false as const, packs: ["development"] };

	beforeEach(() => {
		moduleDir = mkdtempSync(join(tmpdir(), "cursor-rmod-"));
		target = mkdtempSync(join(tmpdir(), "cursor-rtgt-"));
		makeCursorPackModule(moduleDir, ["mk-api-design", "mk-database"]);
	});
	afterEach(() => {
		rmSync(moduleDir, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("upgrading past the rename installs the replacement, removes the old dir, and flushes the ledger", async () => {
		await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		makeCursorPackModule(moduleDir, ["mk-api-design-principles", "mk-backend-development", "mk-database", "mk-devops"]);

		const upgrade = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });

		expect(existsSync(join(target, ".cursor", "skills", "mk-api-design-principles", "SKILL.md"))).toBe(true);
		expect(existsSync(join(target, ".cursor", "skills", "mk-devops", "SKILL.md"))).toBe(true);
		expect(existsSync(join(target, ".cursor", "skills", "mk-api-design"))).toBe(false);
		expect(upgrade.retired).toEqual([
			expect.objectContaining({ skill: "mk-api-design", action: "delete", removed: true }),
		]);

		// The row is gone from the ledger ON DISK, not just in memory — a crash right after
		// this run must not resurrect the directory on the next one.
		const ledgerPath = meowkitStatePaths(join(target, ".meowkit")).cursorLedger;
		const onDisk = JSON.parse(readFileSync(ledgerPath, "utf-8")) as { installations: { item: string }[] };
		expect(onDisk.installations.map((i) => i.item)).not.toContain(".cursor/skills/mk-api-design");

		const rerun = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(rerun.retired).toEqual([]);
		expect(rerun.writes).toBe(0);
	});

	it("a user-modified old dir survives the upgrade and is reported, even with --force", async () => {
		await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		const edited = join(target, ".cursor", "skills", "mk-api-design", "SKILL.md");
		writeFileSync(edited, "# my own copy\n");

		makeCursorPackModule(moduleDir, ["mk-api-design-principles", "mk-database"]);
		const upgrade = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target, force: true });

		expect(readFileSync(edited, "utf-8")).toBe("# my own copy\n");
		expect(upgrade.retired).toEqual([
			expect.objectContaining({ skill: "mk-api-design", action: "skip", removed: false }),
		]);
	});

	it("a dry-run upgrade writes neither the target nor the ledger", async () => {
		await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target });
		const ledgerPath = meowkitStatePaths(join(target, ".meowkit")).cursorLedger;
		const before = readFileSync(ledgerPath, "utf-8");
		makeCursorPackModule(moduleDir, ["mk-api-design-principles", "mk-database"]);

		const plan = await reconcileApplyCursorBundle(moduleDir, target, { ...opts, projectRoot: target, dryRun: true });

		expect(plan.retired).toEqual([
			expect.objectContaining({ skill: "mk-api-design", action: "delete", removed: false }),
		]);
		expect(existsSync(join(target, ".cursor", "skills", "mk-api-design", "SKILL.md"))).toBe(true);
		expect(readFileSync(ledgerPath, "utf-8")).toBe(before);
	});
});
