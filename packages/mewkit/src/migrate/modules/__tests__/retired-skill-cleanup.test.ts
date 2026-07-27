// Destructive-safety coverage for retired-skill cleanup.
//
// The single dangerous operation in the reconcilers is a recursive directory removal, so
// every branch that decides NOT to remove matters more than the branch that does. These
// tests drive the shared helper directly against synthetic bundles/ledgers so each guard —
// provenance, containment, symlink, checksum, dry-run, idempotency — is exercised in
// isolation; the two provider wirings are covered end-to-end in the reconcile-apply suites.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeTreeChecksum } from "../../reconcile/checksum-utils.js";
import type { PortableInstallationV3, PortableRegistryV3 } from "../../reconcile/portable-registry.js";
import { describeRetiredSkills, reconcileRetiredSkills } from "../retired-skill-cleanup.js";

const CONFIG = {
	provider: "codex",
	sourceSkillsPrefix: "root/.agents/skills",
	targetSkillsRoot: ".agents/skills",
} as const;

let moduleDir: string;
let targetDir: string;

/** Author a skill dir in the bundle source (what the current release still ships). */
function authorSkill(name: string, body = "# skill\n"): void {
	const dir = join(moduleDir, "root", ".agents", "skills", name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "SKILL.md"), body);
}

/** Install a skill dir into the target (what an older release put on disk). */
function installSkill(name: string, body = "# skill\n"): string {
	const dir = join(targetDir, ".agents", "skills", name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "SKILL.md"), body);
	return dir;
}

function emptyLedger(): PortableRegistryV3 {
	return { version: "3.0", installations: [] } as unknown as PortableRegistryV3;
}

/** A ledger row as the reconciler would have written it for an installed skill dir. */
async function rowFor(name: string, overrides: Partial<PortableInstallationV3> = {}): Promise<PortableInstallationV3> {
	const path = join(targetDir, ".agents", "skills", name);
	const checksum = existsSync(path) ? await computeTreeChecksum(path) : "sha256:absent";
	return {
		item: `.agents/skills/${name}`,
		type: "skill",
		provider: "codex",
		global: false,
		path,
		installedAt: "2026-01-01T00:00:00.000Z",
		sourcePath: `root/.agents/skills/${name}`,
		sourceChecksum: checksum,
		targetChecksum: checksum,
		installSource: "kit",
		...overrides,
	} as PortableInstallationV3;
}

beforeEach(() => {
	moduleDir = mkdtempSync(join(tmpdir(), "retired-module-"));
	targetDir = mkdtempSync(join(tmpdir(), "retired-target-"));
	// The current bundle always ships the replacement; the retired id never appears here.
	authorSkill("mk-api-design-principles");
	authorSkill("mk-database");
});

afterEach(() => {
	rmSync(moduleDir, { recursive: true, force: true });
	rmSync(targetDir, { recursive: true, force: true });
});

describe("retired-skill cleanup: removal", () => {
	it("removes a pristine retired directory and its ledger row", async () => {
		const dir = installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design"));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toHaveLength(1);
		expect(outcomes[0]).toMatchObject({ skill: "mk-api-design", action: "delete", removed: true });
		expect(existsSync(dir)).toBe(false);
		expect(ledger.installations).toHaveLength(0);
		// The parent skills root is never cleaned up alongside the child.
		expect(existsSync(join(targetDir, ".agents", "skills"))).toBe(true);
	});

	it("drops a stale row when the directory is already gone, without resurrecting content", async () => {
		installSkill("mk-api-design");
		const ledger = emptyLedger();
		const row = await rowFor("mk-api-design");
		ledger.installations.push(row);
		rmSync(join(targetDir, ".agents", "skills", "mk-api-design"), { recursive: true });

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes[0]).toMatchObject({ action: "delete", removed: false, ledgerRowRemoved: true });
		expect(ledger.installations).toHaveLength(0);
		expect(existsSync(join(targetDir, ".agents", "skills", "mk-api-design"))).toBe(false);
	});

	it("is idempotent — a second run finds nothing left to do", async () => {
		installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design"));

		await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });
		const second = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(second).toEqual([]);
	});
});

describe("retired-skill cleanup: preservation", () => {
	it("preserves a modified retired directory byte-for-byte and reports it", async () => {
		const dir = installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design"));
		writeFileSync(join(dir, "SKILL.md"), "# my own notes\n");

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes[0]).toMatchObject({ action: "skip", reasonCode: "user-edits-preserved", removed: false });
		expect(readFileSync(join(dir, "SKILL.md"), "utf-8")).toBe("# my own notes\n");
		expect(ledger.installations).toHaveLength(1);
		expect(describeRetiredSkills(outcomes).join(" ")).toContain("mk-api-design");
	});

	it("preserves a directory with no ledger row at all — no provenance, no deletion", async () => {
		const dir = installSkill("mk-some-hand-written-skill");

		const outcomes = await reconcileRetiredSkills({
			ledger: emptyLedger(),
			moduleDir,
			targetDir,
			config: CONFIG,
		});

		expect(outcomes).toEqual([]);
		expect(existsSync(dir)).toBe(true);
	});

	it("preserves a currently-shipped skill the user simply did not select", async () => {
		// mk-database is still authored; installing a narrower pack must never read as retirement.
		const dir = installSkill("mk-database");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-database"));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toEqual([]);
		expect(existsSync(dir)).toBe(true);
		expect(ledger.installations).toHaveLength(1);
	});

	it("preserves when the ledger records no usable baseline checksum", async () => {
		const dir = installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design", { targetChecksum: "unknown" }));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes[0]).toMatchObject({ action: "skip", reasonCode: "provider-checksum-unavailable" });
		expect(existsSync(dir)).toBe(true);
		expect(ledger.installations).toHaveLength(1);
	});

	it("returns nothing when the authored skills tree cannot be read — retirement is unprovable", async () => {
		installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design"));
		rmSync(join(moduleDir, "root", ".agents", "skills"), { recursive: true });

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toEqual([]);
		expect(existsSync(join(targetDir, ".agents", "skills", "mk-api-design"))).toBe(true);
	});
});

describe("retired-skill cleanup: path guards", () => {
	it("ignores a row pointing outside the skills root", async () => {
		const outside = join(targetDir, "elsewhere", "mk-api-design");
		mkdirSync(outside, { recursive: true });
		writeFileSync(join(outside, "SKILL.md"), "# skill\n");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design", { path: outside }));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toEqual([]);
		expect(existsSync(outside)).toBe(true);
	});

	it("ignores a row whose recorded source path escapes the bundle skills prefix", async () => {
		const dir = installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(
			await rowFor("mk-api-design", { sourcePath: "root/.agents/skills/nested/mk-api-design" }),
		);

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toEqual([]);
		expect(existsSync(dir)).toBe(true);
	});

	it("never removes the skills root itself, however the row spells it", async () => {
		installSkill("mk-api-design");
		const skillsRoot = join(targetDir, ".agents", "skills");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design", { path: skillsRoot }));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toEqual([]);
		expect(existsSync(skillsRoot)).toBe(true);
	});

	it("refuses a symlinked candidate rather than following it", async () => {
		const real = join(targetDir, "real-content");
		mkdirSync(real, { recursive: true });
		writeFileSync(join(real, "SKILL.md"), "# skill\n");
		mkdirSync(join(targetDir, ".agents", "skills"), { recursive: true });
		const link = join(targetDir, ".agents", "skills", "mk-api-design");
		symlinkSync(real, link, "dir");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design", { targetChecksum: await computeTreeChecksum(real) }));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes[0]).toMatchObject({ action: "skip", reasonCode: "target-state-unknown" });
		expect(existsSync(link)).toBe(true);
		expect(existsSync(join(real, "SKILL.md"))).toBe(true);
	});

	it("ignores a row belonging to another provider", async () => {
		const dir = installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design", { provider: "cursor" }));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG });

		expect(outcomes).toEqual([]);
		expect(existsSync(dir)).toBe(true);
	});
});

describe("retired-skill cleanup: dry run", () => {
	it("plans the removal without touching disk or ledger", async () => {
		const dir = installSkill("mk-api-design");
		const ledger = emptyLedger();
		ledger.installations.push(await rowFor("mk-api-design"));

		const outcomes = await reconcileRetiredSkills({ ledger, moduleDir, targetDir, config: CONFIG, dryRun: true });

		expect(outcomes[0]).toMatchObject({ action: "delete", removed: false, ledgerRowRemoved: false });
		expect(existsSync(dir)).toBe(true);
		expect(ledger.installations).toHaveLength(1);
		expect(describeRetiredSkills(outcomes, true).join(" ")).toContain("would be removed");
	});
});
