import { describe, expect, it } from "vitest";
import { reconcile } from "../reconcile/reconciler.js";
import type {
	PortableInstallationV3,
	PortableRegistryV3,
} from "../reconcile/portable-registry.js";
import type {
	ReconcileInput,
	SourceItemState,
	TargetFileState,
} from "../reconcile/reconcile-types.js";

function makeRegistry(installations: PortableInstallationV3[] = []): PortableRegistryV3 {
	return { version: "3.0", installations };
}

function makeSource(item: string, sourceChecksum: string, targetChecksum: string): SourceItemState {
	return {
		item,
		type: "agent",
		sourceChecksum,
		convertedChecksums: { cursor: sourceChecksum },
		targetChecksums: { cursor: targetChecksum },
	};
}

function makeInstall(item: string, sourceChecksum: string, targetChecksum: string): PortableInstallationV3 {
	return {
		item,
		type: "agent",
		provider: "cursor",
		global: false,
		path: ".cursor/rules/" + item + ".mdc",
		installedAt: "2026-01-01T00:00:00Z",
		sourcePath: "/src/" + item + ".md",
		sourceChecksum,
		targetChecksum,
		installSource: "kit",
	};
}

function makeTargetState(path: string, exists: boolean, currentChecksum?: string): TargetFileState {
	return { path, exists, currentChecksum };
}

const baseInput: Pick<ReconcileInput, "providerConfigs"> = {
	providerConfigs: [{ provider: "cursor", global: false }],
};

describe("reconcile — 8-case decision matrix", () => {
	it("case 1: not in registry, target missing → install (new-item)", () => {
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "src1")],
			registry: makeRegistry(),
			targetStates: new Map(),
		};
		const plan = reconcile(input);
		expect(plan.summary.install).toBe(1);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("new-item");
	});

	it("case 2: not in registry but item exists for other providers → new-provider-for-item", () => {
		const otherProvider: PortableInstallationV3 = {
			...makeInstall("scout", "src1", "src1"),
			provider: "codex",
		};
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "src1")],
			registry: makeRegistry([otherProvider]),
			targetStates: new Map(),
		};
		const plan = reconcile(input);
		expect(plan.actions[0].action).toBe("install");
		expect(plan.actions[0].reasonCode).toBe("new-provider-for-item");
	});

	it("case 3: in registry, sources match, target unchanged → skip (no-changes)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "tgt1")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "tgt1")]]),
		};
		const plan = reconcile(input);
		expect(plan.summary.skip).toBe(1);
		expect(plan.actions[0].reasonCode).toBe("no-changes");
	});

	it("case 4: in registry, sources match, target edited by user → skip (user-edits-preserved)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "tgt1")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "user-edited")]]),
		};
		const plan = reconcile(input);
		expect(plan.summary.skip).toBe(1);
		expect(plan.actions[0].reasonCode).toBe("user-edits-preserved");
	});

	it("case 4 with --force: target edited → install (force-overwrite)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "tgt1")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "user-edited")]]),
			force: true,
		};
		const plan = reconcile(input);
		expect(plan.summary.install).toBe(1);
		expect(plan.actions[0].reasonCode).toBe("force-overwrite");
	});

	it("case 5: source changed, target unchanged → update (source-changed)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src2", "tgt2")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "tgt1")]]),
		};
		const plan = reconcile(input);
		expect(plan.summary.update).toBe(1);
		expect(plan.actions[0].reasonCode).toBe("source-changed");
	});

	it("case 6: source changed AND target changed → conflict (both-changed)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src2", "tgt2")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "user-edited")]]),
		};
		const plan = reconcile(input);
		expect(plan.summary.conflict).toBe(1);
		expect(plan.hasConflicts).toBe(true);
		expect(plan.actions[0].reasonCode).toBe("both-changed");
	});

	it("case 7: source removed but registry has entry → delete (source-removed-orphan)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "tgt1")]]),
		};
		const plan = reconcile(input);
		expect(plan.summary.delete).toBe(1);
		expect(plan.actions[0].reasonCode).toBe("source-removed-orphan");
	});

	it("case 8: unknown checksums in registry (v2 entry) + target matches → backfill skip", () => {
		const reg: PortableInstallationV3 = {
			...makeInstall("scout", "unknown", "unknown"),
		};
		const source = makeSource("scout", "src1", "src1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [source],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "src1")]]),
		};
		const plan = reconcile(input);
		expect(plan.summary.skip).toBe(1);
		expect(plan.actions[0].reasonCode).toBe("target-up-to-date-backfill");
		expect(plan.actions[0].backfillRegistry).toBe(true);
	});

	it("target deleted by user, source unchanged → skip (user-deleted-respected)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "tgt1")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, false)]]),
		};
		const plan = reconcile(input);
		expect(plan.actions[0].action).toBe("skip");
		expect(plan.actions[0].reasonCode).toBe("user-deleted-respected");
	});

	it("replay safety: same input twice → identical plans (deterministic)", () => {
		const reg = makeInstall("scout", "src1", "tgt1");
		const input: ReconcileInput = {
			...baseInput,
			sourceItems: [makeSource("scout", "src1", "tgt1")],
			registry: makeRegistry([reg]),
			targetStates: new Map([[reg.path, makeTargetState(reg.path, true, "tgt1")]]),
		};
		const plan1 = reconcile(input);
		const plan2 = reconcile(input);
		expect(plan1).toEqual(plan2);
		expect(plan1.summary.install).toBe(0);
		expect(plan1.summary.update).toBe(0);
	});
});
