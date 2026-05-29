import { describe, expect, it } from "vitest";
import { reconcile } from "../reconcile/reconciler.js";
import type { PortableInstallationV3, PortableRegistryV3 } from "../reconcile/portable-registry.js";
import type { PortableEvolutionManifest } from "../reconcile/portable-manifest.js";
import type { ReconcileInput, SourceItemState, TargetFileState } from "../reconcile/reconcile-types.js";

function makeRegistry(installations: PortableInstallationV3[] = []): PortableRegistryV3 {
	return { version: "3.0", installations };
}

function makeManifest(overrides: Partial<PortableEvolutionManifest> = {}): PortableEvolutionManifest {
	return {
		version: "1.0",
		mewkitVersion: "1.10.0",
		renames: [],
		providerPathMigrations: [],
		sectionRenames: [],
		...overrides,
	};
}

function makeSource(item: string): SourceItemState {
	return {
		item,
		type: "agent",
		sourceChecksum: "src-new",
		convertedChecksums: { cursor: "src-new" },
		targetChecksums: { cursor: "target-new" },
	};
}

function makeInstall(overrides: Partial<PortableInstallationV3> = {}): PortableInstallationV3 {
	return {
		item: "old-scout",
		type: "agent",
		provider: "cursor",
		global: false,
		path: ".cursor/rules/old-scout.mdc",
		installedAt: "2026-01-01T00:00:00Z",
		sourcePath: "agents/old-scout.md",
		sourceChecksum: "src-old",
		targetChecksum: "target-old",
		installSource: "kit",
		...overrides,
	};
}

function makeTargetState(path: string, exists = true, currentChecksum = "target-old"): TargetFileState {
	return { path, exists, currentChecksum };
}

function makeInput(overrides: Partial<ReconcileInput>): ReconcileInput {
	return {
		sourceItems: [makeSource("new-scout")],
		registry: makeRegistry(),
		targetStates: new Map(),
		providerConfigs: [{ provider: "cursor", global: false }],
		...overrides,
	};
}

describe("reconcile manifest cleanup", () => {
	it("emits rename cleanup for registry-owned old source paths", () => {
		const oldInstall = makeInstall();
		const plan = reconcile(
			makeInput({
				registry: makeRegistry([oldInstall]),
				targetStates: new Map([[oldInstall.path, makeTargetState(oldInstall.path)]]),
				manifest: makeManifest({
					renames: [{ from: "agents/old-scout.md", to: "agents/new-scout.md", type: "agent", since: "1.10.0" }],
				}),
			}),
		);

		const cleanup = plan.actions.find((action) => action.reasonCode === "renamed-cleanup");
		expect(cleanup?.action).toBe("delete");
		expect(cleanup?.targetPath).toBe(oldInstall.path);
	});

	it("emits provider path cleanup for old target directories", () => {
		const oldInstall = makeInstall({ path: ".cursor/legacy-rules/scout.mdc" });
		const plan = reconcile(
			makeInput({
				registry: makeRegistry([oldInstall]),
				targetStates: new Map([[oldInstall.path, makeTargetState(oldInstall.path)]]),
				manifest: makeManifest({
					providerPathMigrations: [
						{
							provider: "cursor",
							type: "agent",
							from: ".cursor/legacy-rules",
							to: ".cursor/rules",
							since: "1.10.0",
						},
					],
				}),
			}),
		);

		const cleanup = plan.actions.find((action) => action.reasonCode === "path-migrated-cleanup");
		expect(cleanup?.action).toBe("delete");
		expect(cleanup?.targetPath).toBe(oldInstall.path);
	});

	it("reinstalls the same item at the new provider path during path migration", () => {
		const oldInstall = makeInstall({
			item: "new-scout",
			path: ".cursor/legacy-rules/new-scout.mdc",
			sourcePath: "agents/new-scout.md",
			sourceChecksum: "src-new",
			targetChecksum: "target-new",
		});
		const plan = reconcile(
			makeInput({
				registry: makeRegistry([oldInstall]),
				targetStates: new Map([[oldInstall.path, makeTargetState(oldInstall.path, true, "target-new")]]),
				manifest: makeManifest({
					providerPathMigrations: [
						{
							provider: "cursor",
							type: "agent",
							from: ".cursor/legacy-rules",
							to: ".cursor/rules",
							since: "1.10.0",
						},
					],
				}),
			}),
		);

		const install = plan.actions.find((action) => action.action === "install" && action.item === "new-scout");
		const cleanup = plan.actions.find((action) => action.reasonCode === "path-migrated-cleanup");
		expect(install?.targetPath).toBe("");
		expect(cleanup?.targetPath).toBe(oldInstall.path);
	});

	it("skips manual entries and providers outside this run", () => {
		const manual = makeInstall({ installSource: "manual" });
		const inactiveProvider = makeInstall({ item: "other", provider: "codex", path: ".codex/agents/other.md" });
		const plan = reconcile(
			makeInput({
				registry: makeRegistry([manual, inactiveProvider]),
				targetStates: new Map([
					[manual.path, makeTargetState(manual.path)],
					[inactiveProvider.path, makeTargetState(inactiveProvider.path)],
				]),
				manifest: makeManifest({
					renames: [
						{ from: "agents/old-scout.md", to: "agents/new-scout.md", type: "agent", since: "1.10.0" },
						{ from: "agents/other.md", to: "agents/new-other.md", type: "agent", since: "1.10.0" },
					],
				}),
			}),
		);

		expect(plan.actions.some((action) => action.reasonCode === "renamed-cleanup")).toBe(false);
	});

	it("preserves user edits at old paths instead of deleting", () => {
		const oldInstall = makeInstall();
		const plan = reconcile(
			makeInput({
				registry: makeRegistry([oldInstall]),
				targetStates: new Map([[oldInstall.path, makeTargetState(oldInstall.path, true, "user-edited")]]),
				manifest: makeManifest({
					renames: [{ from: "agents/old-scout.md", to: "agents/new-scout.md", type: "agent", since: "1.10.0" }],
				}),
			}),
		);

		expect(plan.actions.some((action) => action.reasonCode === "renamed-cleanup")).toBe(false);
	});
});
