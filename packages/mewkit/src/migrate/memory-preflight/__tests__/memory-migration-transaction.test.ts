import {
	mkdtempSync,
	mkdirSync,
	existsSync,
	readFileSync,
	writeFileSync,
	rmSync,
	readdirSync,
	realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMemoryPreflight } from "../memory-preflight.js";
import {
	runMemoryMigrationTransaction,
	recoverMemoryMigration,
	pruneRunDirs,
} from "../memory-migration-transaction.js";
import { writeManifest, readManifest, type MigrationManifest } from "../migration-manifest.js";
import { detectLegacyDrift } from "../legacy-drift-detector.js";
import { meowkitStatePaths } from "../../../state/meowkit-state-paths.js";
import { buildFixture, validFixes } from "./memory-preflight-fixtures.js";

let root: string;
let meowkit: string;

beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "meowkit-txn-")));
	meowkit = join(root, ".meowkit");
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const legacyPath = (rel: string) => join(root, ".claude", "memory", rel);
const meowkitPath = (rel: string) => join(meowkit, rel);
const migrationsDir = () => meowkitStatePaths(meowkit).migrations;
const runDirs = () => (existsSync(migrationsDir()) ? readdirSync(migrationsDir()) : []);

async function migrate(runId = "run-1") {
	const plan = await runMemoryPreflight(root);
	return runMemoryMigrationTransaction(plan, { projectRoot: root, runId, now: "2026-07-22T00:00:00.000Z" });
}

describe("transaction — happy path + idempotency", () => {
	it("publishes every action to its taxonomy target, archives legacy, writes a complete manifest", async () => {
		buildFixture("legacy-only", root);
		const res = await migrate();
		expect(res.status).toBe("complete");
		expect(res.published).toBe(6); // 6 staged files; .gitkeep skipped

		// Targets published across the taxonomy.
		expect(existsSync(meowkitPath("memory/fixes.json"))).toBe(true);
		expect(existsSync(meowkitPath("telemetry/cost-log.json"))).toBe(true);
		expect(existsSync(meowkitPath("state/last-model-id.txt"))).toBe(true);
		expect(existsSync(meowkitPath("cache/wiki-index.db"))).toBe(true);
		expect(existsSync(meowkitPath("memory/legacy/random-note.txt"))).toBe(true);
		expect(readFileSync(meowkitPath("memory/fixes.json"), "utf-8")).toBe(validFixes());

		// Legacy sources archived; .gitkeep retained.
		expect(existsSync(legacyPath("fixes.json"))).toBe(false);
		expect(existsSync(legacyPath(".gitkeep"))).toBe(true);
		expect(existsSync(join(migrationsDir(), "run-1", "legacy-archive", "fixes.json"))).toBe(true);

		const manifest = await readManifest(join(migrationsDir(), "run-1", "manifest.json"));
		expect(manifest?.status).toBe("complete");
	});

	it("second run is a no-op and creates zero new run-dirs", async () => {
		buildFixture("legacy-only", root);
		await migrate("run-1");
		const before = runDirs();
		const plan2 = await runMemoryPreflight(root);
		expect(plan2.noop).toBe(true);
		const res2 = await runMemoryMigrationTransaction(plan2, { projectRoot: root, runId: "run-2" });
		expect(res2.status).toBe("noop");
		expect(res2.runId).toBeNull();
		expect(runDirs().sort()).toEqual(before.sort());
	});

	it("aborts on conflict before any publish; target untouched, no run-dir", async () => {
		buildFixture("conflicting", root);
		const original = readFileSync(meowkitPath("memory/fixes.json"), "utf-8");
		const plan = await runMemoryPreflight(root);
		const res = await runMemoryMigrationTransaction(plan, { projectRoot: root, runId: "run-x" });
		expect(res.status).toBe("aborted");
		expect(res.reason).toBe("conflicts");
		expect(readFileSync(meowkitPath("memory/fixes.json"), "utf-8")).toBe(original);
		expect(runDirs()).toEqual([]);
		// Pre-state intact: the legacy source stays live (never archived on an abort).
		expect(existsSync(legacyPath("fixes.json"))).toBe(true);
		expect(readFileSync(legacyPath("fixes.json"), "utf-8")).toBe(validFixes("legacy version"));
	});
});

describe("transaction — interruption + recovery", () => {
	it("crash after staging (before publish) → targets untouched; recovery completes", async () => {
		buildFixture("legacy-only", root);
		const plan = await runMemoryPreflight(root);
		await expect(
			runMemoryMigrationTransaction(plan, {
				projectRoot: root,
				runId: "run-1",
				hooks: {
					afterStageAll: () => {
						throw new Error("crash-after-stage");
					},
				},
			}),
		).rejects.toThrow("crash-after-stage");

		// Nothing published yet; manifest in-progress.
		expect(existsSync(meowkitPath("memory/fixes.json"))).toBe(false);
		const midManifest = await readManifest(join(migrationsDir(), "run-1", "manifest.json"));
		expect(midManifest?.status).toBe("in-progress");

		const rec = await recoverMemoryMigration(meowkit, { projectRoot: root });
		expect(rec.status).toBe("complete");
		expect(readFileSync(meowkitPath("memory/fixes.json"), "utf-8")).toBe(validFixes());
		expect(existsSync(legacyPath("fixes.json"))).toBe(false); // archived on resume
	});

	it("crash mid-publish → recovery yields fully-published (new-valid) state", async () => {
		buildFixture("legacy-only", root);
		const plan = await runMemoryPreflight(root);
		let published = 0;
		await expect(
			runMemoryMigrationTransaction(plan, {
				projectRoot: root,
				runId: "run-1",
				hooks: {
					afterPublish: () => {
						if (++published >= 3) throw new Error("crash-mid-publish");
					},
				},
			}),
		).rejects.toThrow("crash-mid-publish");

		const rec = await recoverMemoryMigration(meowkit, { projectRoot: root });
		expect(rec.status).toBe("complete");
		// All six targets present after resume.
		expect(existsSync(meowkitPath("memory/fixes.json"))).toBe(true);
		expect(existsSync(meowkitPath("cache/wiki-index.db"))).toBe(true);
		expect(readdirSync(join(root, ".claude", "memory"))).toEqual([".gitkeep"]);
	});

	it("torn/unparsable manifest → recovery aborts (legacy authoritative, no partial resume)", async () => {
		const runDir = join(migrationsDir(), "run-corrupt");
		mkdirSync(runDir, { recursive: true });
		writeFileSync(join(runDir, "manifest.json"), "{ this is not valid json");
		const rec = await recoverMemoryMigration(meowkit, { projectRoot: root });
		expect(rec.status).toBe("aborted");
		expect(rec.reason).toBe("corrupt-manifest");
	});
});

describe("transaction — concurrent-writer fencing", () => {
	it("a legacy source mutated before its archive move stays live and is reported (not swept)", async () => {
		buildFixture("legacy-only", root);
		const plan = await runMemoryPreflight(root);
		const res = await runMemoryMigrationTransaction(plan, {
			projectRoot: root,
			runId: "run-1",
			hooks: {
				beforeArchive: (entry) => {
					if (entry.relPath === "fixes.md") writeFileSync(legacyPath("fixes.md"), "MUTATED AFTER STAGING");
				},
			},
		});
		expect(res.status).toBe("complete");
		// fixes.md left live in legacy (fenced); its target still holds the staged snapshot.
		expect(existsSync(legacyPath("fixes.md"))).toBe(true);
		expect(readFileSync(legacyPath("fixes.md"), "utf-8")).toBe("MUTATED AFTER STAGING");
		expect(res.fenced.some((e) => e.relPath === "fixes.md")).toBe(true);
		// The mutated content was never archived.
		expect(existsSync(join(migrationsDir(), "run-1", "legacy-archive", "fixes.md"))).toBe(false);
		// Other files archived normally.
		expect(existsSync(legacyPath("fixes.json"))).toBe(false);
	});
});

describe("transaction — force never touches user memory", () => {
	it("--force still aborts on a memory conflict", async () => {
		buildFixture("conflicting", root);
		const plan = await runMemoryPreflight(root);
		const res = await runMemoryMigrationTransaction(plan, { projectRoot: root, runId: "run-x", force: true });
		expect(res.status).toBe("aborted");
		expect(res.reason).toBe("conflicts");
	});
});

describe("transaction — single lock domain", () => {
	it("is blocked when the project migrate.lock is already held by a live process", async () => {
		buildFixture("legacy-only", root);
		const paths = meowkitStatePaths(meowkit);
		mkdirSync(paths.state, { recursive: true });
		writeFileSync(paths.migrateLock, `${process.pid}\n${Date.now()}\n`); // live holder
		const plan = await runMemoryPreflight(root);
		const res = await runMemoryMigrationTransaction(plan, { projectRoot: root, runId: "run-1" });
		expect(res.status).toBe("blocked");
		expect(res.heldBy).toBe(process.pid);
		expect(existsSync(meowkitPath("memory/fixes.json"))).toBe(false);
	});
});

describe("drift detection", () => {
	it("flags a post-migration user write and a managed empty dir with attribution", async () => {
		buildFixture("legacy-only", root);
		await migrate();
		// Pre-drift: clean.
		expect(detectLegacyDrift(root).hasDrift).toBe(false);
		// A user rewrites a legacy file; managed code recreates an empty dir.
		writeFileSync(legacyPath("fixes.json"), "user wrote here again");
		mkdirSync(legacyPath("logs"), { recursive: true });
		const drift = detectLegacyDrift(root);
		expect(drift.migrated).toBe(true);
		expect(drift.hasDrift).toBe(true);
		expect(drift.drifted.find((d) => d.relPath === "fixes.json")?.kind).toBe("user");
		expect(drift.drifted.find((d) => d.relPath === "logs")?.kind).toBe("managed");
	});

	it("reports no drift for a pre-migration project", () => {
		buildFixture("legacy-only", root); // never migrated
		expect(detectLegacyDrift(root)).toMatchObject({ migrated: false, hasDrift: false });
	});
});

describe("retention", () => {
	it("prunes only staging/ of runs beyond the newest N; manifests + archives kept", async () => {
		const mig = migrationsDir();
		for (const id of ["run-01", "run-02", "run-03", "run-04", "run-05"]) {
			mkdirSync(join(mig, id, "staging"), { recursive: true });
			mkdirSync(join(mig, id, "legacy-archive"), { recursive: true });
			writeFileSync(join(mig, id, "manifest.json"), "{}");
			writeFileSync(join(mig, id, "staging", "f"), "x");
		}
		await pruneRunDirs(meowkit, 3);
		// Newest 3 keep staging; older 2 lose staging but keep manifest + archive.
		expect(existsSync(join(mig, "run-05", "staging"))).toBe(true);
		expect(existsSync(join(mig, "run-03", "staging"))).toBe(true);
		expect(existsSync(join(mig, "run-02", "staging"))).toBe(false);
		expect(existsSync(join(mig, "run-01", "staging"))).toBe(false);
		expect(existsSync(join(mig, "run-01", "manifest.json"))).toBe(true);
		expect(existsSync(join(mig, "run-01", "legacy-archive"))).toBe(true);
	});
});

describe("migration-manifest", () => {
	it("round-trips a manifest and fails closed on a torn file", async () => {
		const p = join(root, "m.json");
		const manifest: MigrationManifest = {
			runId: "r1",
			createdAt: "2026-07-22T00:00:00.000Z",
			legacyRoot: "/l",
			meowkitRoot: "/m",
			status: "in-progress",
			entries: [
				{
					relPath: "a",
					sourcePath: "/l/a",
					targetClass: "memory",
					targetRelPath: "memory/a",
					checksum: "abc",
					action: "stage",
					outcome: "staged",
				},
			],
		};
		await writeManifest(p, manifest);
		expect(await readManifest(p)).toEqual(manifest);
		writeFileSync(p, "{ truncated");
		expect(await readManifest(p)).toBeNull();
	});
});
