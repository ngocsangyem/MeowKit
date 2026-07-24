import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PortableInstallationV3 } from "../../reconcile/portable-registry.js";
import { decideCodexEntryAction, reconcileApplyCodexBundle } from "../codex-reconcile-apply.js";

// ── Pure decision matrix (fast, exhaustive) ──────────────────────────────────

const MANAGED = "managed-replace" as const;
function row(source: string, target: string): PortableInstallationV3 {
	return {
		item: "AGENTS.md",
		type: "config",
		provider: "codex",
		global: false,
		path: "/p/AGENTS.md",
		installedAt: "2026-07-23T00:00:00.000Z",
		sourcePath: "root/AGENTS.md",
		sourceChecksum: source,
		targetChecksum: target,
		installSource: "kit",
	};
}

describe("decideCodexEntryAction", () => {
	it("installs a brand-new artifact (no ledger row, no target)", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "a",
			targetExists: false,
			currentTargetChecksum: undefined,
			row: undefined,
		});
		expect(d).toMatchObject({ action: "install", reasonCode: "new-item", write: true, recordLedger: true });
	});

	it("adopts an unregistered target that already matches the source (no write, records baseline)", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "a",
			targetExists: true,
			currentTargetChecksum: "a",
			row: undefined,
		});
		expect(d).toMatchObject({
			action: "skip",
			reasonCode: "target-up-to-date-backfill",
			write: false,
			recordLedger: true,
		});
	});

	it("conflicts (never blind-installs) on an unregistered target that differs from the source", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "a",
			targetExists: true,
			currentTargetChecksum: "b",
			row: undefined,
		});
		expect(d).toMatchObject({ action: "conflict", reasonCode: "both-changed", write: false, recordLedger: false });
	});

	it("force overwrites an unregistered differing target (overlay/--force)", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: true,
			srcChecksum: "a",
			targetExists: true,
			currentTargetChecksum: "b",
			row: undefined,
		});
		expect(d).toMatchObject({ action: "install", reasonCode: "force-overwrite", write: true });
	});

	it("skips when nothing changed (idempotent)", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "a",
			targetExists: true,
			currentTargetChecksum: "a",
			row: row("a", "a"),
		});
		expect(d).toMatchObject({ action: "skip", reasonCode: "no-changes", write: false });
	});

	it("updates when source changed but the user did not edit the target", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "b",
			targetExists: true,
			currentTargetChecksum: "a",
			row: row("a", "a"),
		});
		expect(d).toMatchObject({ action: "update", reasonCode: "source-changed", write: true });
	});

	it("preserves a user edit when the source is unchanged", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "a",
			targetExists: true,
			currentTargetChecksum: "z",
			row: row("a", "a"),
		});
		expect(d).toMatchObject({ action: "skip", reasonCode: "user-edits-preserved", write: false });
	});

	it("conflicts when both the source and the user's target changed", () => {
		const d = decideCodexEntryAction({
			ownership: MANAGED,
			force: false,
			srcChecksum: "b",
			targetExists: true,
			currentTargetChecksum: "z",
			row: row("a", "a"),
		});
		expect(d).toMatchObject({ action: "conflict", reasonCode: "both-changed", write: false });
	});

	it("reinstalls a deleted target when the source changed; respects the deletion otherwise", () => {
		expect(
			decideCodexEntryAction({
				ownership: MANAGED,
				force: false,
				srcChecksum: "b",
				targetExists: false,
				currentTargetChecksum: undefined,
				row: row("a", "a"),
			}),
		).toMatchObject({ action: "install", reasonCode: "target-deleted-source-changed" });
		expect(
			decideCodexEntryAction({
				ownership: MANAGED,
				force: false,
				srcChecksum: "a",
				targetExists: false,
				currentTargetChecksum: undefined,
				row: row("a", "a"),
			}),
		).toMatchObject({ action: "skip", reasonCode: "user-deleted-respected" });
	});

	it("never touches a user-owned artifact", () => {
		const d = decideCodexEntryAction({
			ownership: "user-owned-never-touch",
			force: true,
			srcChecksum: "a",
			targetExists: true,
			currentTargetChecksum: "b",
			row: undefined,
		});
		expect(d).toMatchObject({ action: "skip", write: false, recordLedger: false });
	});
});

// ── Integration against a synthetic fixture module ───────────────────────────

function makeModule(dir: string): void {
	mkdirSync(join(dir, "root", ".codex"), { recursive: true });
	writeFileSync(join(dir, "root", "AGENTS.md"), "# authored agents\n");
	writeFileSync(join(dir, "root", ".codex", "config.toml"), 'model = "x"\n');
	const manifest = {
		version: "1.0",
		provider: "codex",
		generatedFrom: "test",
		entries: [
			{
				sourcePath: "root/AGENTS.md",
				targetPath: "AGENTS.md",
				provider: "codex",
				mode: "0644",
				ownership: "managed-replace",
				scopeTags: ["managed-runtime"],
				active: false,
			},
			{
				sourcePath: "root/.codex/config.toml",
				targetPath: ".codex/config.toml",
				provider: "codex",
				mode: "0644",
				ownership: "managed-replace",
				scopeTags: ["managed-runtime"],
				active: false,
			},
		],
	};
	writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

describe("reconcileApplyCodexBundle (integration)", () => {
	let moduleDir: string;
	let target: string;
	const opts = { projectRoot: "", adoptHomeRegistry: false as const };

	beforeEach(() => {
		moduleDir = mkdtempSync(join(tmpdir(), "codex-mod-"));
		target = mkdtempSync(join(tmpdir(), "codex-tgt-"));
		makeModule(moduleDir);
	});
	afterEach(() => {
		rmSync(moduleDir, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("installs on a fresh target and creates the project ledger", async () => {
		const r = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(r.writes).toBe(2);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(target, ".codex", "config.toml"))).toBe(true);
		expect(existsSync(join(target, ".meowkit", "state", "codex-ledger.json"))).toBe(true);
	});

	it("is idempotent: a second run writes nothing", async () => {
		await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		const second = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(second.writes).toBe(0);
		expect(second.entries.every((e) => e.action === "skip" && e.reasonCode === "no-changes")).toBe(true);
	});

	it("dry-run writes no files and no ledger, but reports the plan", async () => {
		const r = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target, dryRun: true });
		expect(r.dryRun).toBe(true);
		expect(r.entries.filter((e) => e.action === "install").length).toBe(2);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(target, ".meowkit"))).toBe(false);
	});

	it("preserves a user edit on re-run, and overwrites it only with --force", async () => {
		await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		writeFileSync(join(target, "AGENTS.md"), "# MY EDIT\n");

		const preserve = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		const agents = preserve.entries.find((e) => e.targetPath === "AGENTS.md");
		expect(agents).toMatchObject({ action: "skip", reasonCode: "user-edits-preserved" });
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toBe("# MY EDIT\n");

		const forced = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target, force: true });
		expect(forced.entries.find((e) => e.targetPath === "AGENTS.md")?.wrote).toBe(true);
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toBe("# authored agents\n");
	});

	it("adoption-as-conflict: a pre-existing differing target (no ledger) conflicts, never overwritten", async () => {
		writeFileSync(join(target, "AGENTS.md"), "# pre-existing user content\n");
		const r = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		const agents = r.entries.find((e) => e.targetPath === "AGENTS.md");
		expect(agents).toMatchObject({ action: "conflict" });
		expect(r.conflicts.map((c) => c.targetPath)).toContain("AGENTS.md");
		expect(readFileSync(join(target, "AGENTS.md"), "utf-8")).toBe("# pre-existing user content\n");
		// The other (fresh) entry still installs.
		expect(existsSync(join(target, ".codex", "config.toml"))).toBe(true);
	});

	it("adoption: a pre-existing target identical to the source is adopted silently, then idempotent", async () => {
		mkdirSync(join(target, ".codex"), { recursive: true });
		writeFileSync(join(target, "AGENTS.md"), "# authored agents\n");
		writeFileSync(join(target, ".codex", "config.toml"), 'model = "x"\n');
		const r = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(r.writes).toBe(0);
		expect(r.conflicts).toHaveLength(0);
		const second = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(second.writes).toBe(0);
	});

	it("two projects are isolated: an edit in one never affects the other's reconcile", async () => {
		const targetB = mkdtempSync(join(tmpdir(), "codex-tgtB-"));
		try {
			await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
			await reconcileApplyCodexBundle(moduleDir, targetB, { ...opts, projectRoot: targetB });
			writeFileSync(join(target, "AGENTS.md"), "# edit in A only\n");

			const a = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
			const b = await reconcileApplyCodexBundle(moduleDir, targetB, { ...opts, projectRoot: targetB });
			expect(a.entries.find((e) => e.targetPath === "AGENTS.md")).toMatchObject({ reasonCode: "user-edits-preserved" });
			expect(b.writes).toBe(0);
			expect(b.entries.every((e) => e.reasonCode === "no-changes")).toBe(true);
		} finally {
			rmSync(targetB, { recursive: true, force: true });
		}
	});
});

// A manifest entry can be a whole directory (agents/, skills/) reconciled as one unit
// via a tree checksum. These exercise that path end-to-end (the file-entry fixture above
// never touches computeTreeChecksum through the apply).
function makeDirModule(dir: string): void {
	mkdirSync(join(dir, "root", ".agents", "skills", "fix"), { recursive: true });
	mkdirSync(join(dir, "root", ".agents", "skills", "plan"), { recursive: true });
	writeFileSync(join(dir, "root", ".agents", "skills", "fix", "SKILL.md"), "# fix\n");
	writeFileSync(join(dir, "root", ".agents", "skills", "plan", "SKILL.md"), "# plan\n");
	const manifest = {
		version: "1.0",
		provider: "codex",
		generatedFrom: "test",
		entries: [
			{
				sourcePath: "root/.agents/skills",
				targetPath: ".agents/skills",
				provider: "codex",
				mode: "0644",
				ownership: "managed-replace",
				scopeTags: ["managed-runtime"],
				active: false,
			},
		],
	};
	writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

describe("reconcileApplyCodexBundle — directory (tree-hashed) entries", () => {
	let moduleDir: string;
	let target: string;
	const opts = { adoptHomeRegistry: false as const };

	beforeEach(() => {
		moduleDir = mkdtempSync(join(tmpdir(), "codex-dmod-"));
		target = mkdtempSync(join(tmpdir(), "codex-dtgt-"));
		makeDirModule(moduleDir);
	});
	afterEach(() => {
		rmSync(moduleDir, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("installs the whole tree, then a second run writes nothing (tree checksum is stable)", async () => {
		const first = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(first.writes).toBe(1);
		expect(existsSync(join(target, ".agents", "skills", "fix", "SKILL.md"))).toBe(true);
		expect(existsSync(join(target, ".agents", "skills", "plan", "SKILL.md"))).toBe(true);

		const second = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(second.writes).toBe(0);
		expect(second.entries[0]).toMatchObject({ action: "skip", reasonCode: "no-changes" });
	});

	it("preserves a user edit to a file INSIDE the installed tree (dir entry not re-copied)", async () => {
		await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		writeFileSync(join(target, ".agents", "skills", "fix", "SKILL.md"), "# MY EDIT inside the tree\n");

		const rerun = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target });
		expect(rerun.entries[0]).toMatchObject({ action: "skip", reasonCode: "user-edits-preserved" });
		expect(readFileSync(join(target, ".agents", "skills", "fix", "SKILL.md"), "utf-8")).toBe(
			"# MY EDIT inside the tree\n",
		);

		const forced = await reconcileApplyCodexBundle(moduleDir, target, { ...opts, projectRoot: target, force: true });
		expect(forced.entries[0]?.wrote).toBe(true);
		expect(readFileSync(join(target, ".agents", "skills", "fix", "SKILL.md"), "utf-8")).toBe("# fix\n");
	});
});
