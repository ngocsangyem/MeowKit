// Vendored from claudekit-cli (MIT). Source: src/commands/portable/reconciler.ts
// Pure reconciler module — zero I/O, fully testable.
// Mewkit-side adaptation: dropped manifest-driven rename/path-migration entry points
// (greenfield install — no v1→v2 migrations to encode). The 8-case decision matrix is
// ported verbatim. Reconciler stays pure (no fs, no path I/O).
import path from "node:path";
import type { PortableInstallationV3 } from "./portable-registry.js";
import {
	UNKNOWN_CHECKSUM,
	getReasonCopy,
	isUnknownChecksum,
	normalizeChecksum,
} from "./reconcile-types.js";
import type {
	ReconcileAction,
	ReconcileBanner,
	ReconcileInput,
	ReconcilePlan,
	ReconcileProviderInput,
	ReconcileReason,
	SourceItemState,
	TargetDirectoryState,
	TargetFileState,
} from "./reconcile-types.js";

type TargetChangeState = "unchanged" | "changed" | "deleted" | "unknown";

function normalizePortablePath(value: string): string {
	const asPosix = value.replace(/\\/g, "/");
	const normalized = path.posix.normalize(asPosix);
	if (normalized === ".") return "";
	return normalized.replace(/^\.\/+/, "");
}

function makeProviderConfigKey(provider: string, global: boolean): string {
	return JSON.stringify([provider, global]);
}

function makeItemTypeKey(item: string, type: SourceItemState["type"]): string {
	return JSON.stringify([item, type]);
}

function makeRegistryIdentityKey(entry: {
	item: string;
	type: ReconcileAction["type"];
	provider: string;
	global: boolean;
}): string {
	return JSON.stringify([entry.item, entry.type, entry.provider, entry.global]);
}

function makeDirStateKey(provider: string, type: ReconcileAction["type"], global: boolean): string {
	return JSON.stringify([provider, type, global]);
}

function dedupeProviderConfigs(
	providerConfigs: ReconcileProviderInput[],
): ReconcileProviderInput[] {
	const seen = new Set<string>();
	const unique: ReconcileProviderInput[] = [];
	for (const config of providerConfigs) {
		const key = makeProviderConfigKey(config.provider, config.global);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(config);
	}
	return unique;
}

function buildTargetStateIndex(
	targetStates: Map<string, TargetFileState>,
): Map<string, TargetFileState> {
	const index = new Map<string, TargetFileState>();
	for (const [mapPath, state] of targetStates) {
		const normalizedMapPath = normalizePortablePath(mapPath);
		if (normalizedMapPath && !index.has(normalizedMapPath)) index.set(normalizedMapPath, state);
		const normalizedStatePath = normalizePortablePath(state.path);
		if (normalizedStatePath && !index.has(normalizedStatePath)) index.set(normalizedStatePath, state);
	}
	return index;
}

function buildDirStateIndex(dirStates: TargetDirectoryState[]): Map<string, TargetDirectoryState> {
	const index = new Map<string, TargetDirectoryState>();
	for (const ds of dirStates) {
		index.set(makeDirStateKey(ds.provider, ds.type, ds.global), ds);
	}
	return index;
}

function lookupTargetState(
	targetStateIndex: Map<string, TargetFileState>,
	pathValue: string,
): TargetFileState | undefined {
	return targetStateIndex.get(normalizePortablePath(pathValue));
}

function getManagedSectionKind(type: ReconcileAction["type"]): "agent" | "rule" | "config" | null {
	if (type === "agent") return "agent";
	if (type === "rules") return "rule";
	if (type === "config") return "config";
	return null;
}

function getExpectedTargetChecksum(source: SourceItemState, provider: string): string {
	return normalizeChecksum(
		source.targetChecksums?.[provider] ?? source.convertedChecksums[provider],
	);
}

function getCurrentTargetChecksum(
	targetState: TargetFileState | undefined,
	registryEntry: PortableInstallationV3,
): string {
	if (!targetState) return UNKNOWN_CHECKSUM;
	if (!targetState.exists) return UNKNOWN_CHECKSUM;

	if (targetState.sectionChecksums && registryEntry.ownedSections?.length) {
		const sectionKind = getManagedSectionKind(registryEntry.type);
		const sectionName = registryEntry.ownedSections[0];
		if (sectionKind && sectionName) {
			return normalizeChecksum(targetState.sectionChecksums[`${sectionKind}:${sectionName}`]);
		}
		return UNKNOWN_CHECKSUM;
	}

	return normalizeChecksum(targetState.currentChecksum);
}

function getTargetChangeState(
	targetState: TargetFileState | undefined,
	registryEntry: PortableInstallationV3,
	registeredTargetChecksum: string,
): TargetChangeState {
	if (!targetState) return "unknown";
	if (!targetState.exists) return "deleted";

	const currentTargetChecksum = getCurrentTargetChecksum(targetState, registryEntry);
	if (isUnknownChecksum(currentTargetChecksum) || isUnknownChecksum(registeredTargetChecksum)) {
		return "unknown";
	}
	return currentTargetChecksum === registeredTargetChecksum ? "unchanged" : "changed";
}

function dedupeActions(actions: ReconcileAction[]): ReconcileAction[] {
	const seen = new Set<string>();
	const deduped: ReconcileAction[] = [];
	for (const action of actions) {
		const key = JSON.stringify([
			action.action, action.item, action.type, action.provider, action.global,
			normalizePortablePath(action.targetPath),
		]);
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(action);
	}
	return deduped;
}

function suppressOverlappingActions(actions: ReconcileAction[]): ReconcileAction[] {
	const byIdentity = new Map<string, ReconcileAction[]>();
	for (const action of actions) {
		const key = makeRegistryIdentityKey(action);
		const list = byIdentity.get(key) ?? [];
		list.push(action);
		byIdentity.set(key, list);
	}

	const filtered: ReconcileAction[] = [];
	for (const action of actions) {
		const key = makeRegistryIdentityKey(action);
		const actionsForKey = byIdentity.get(key) ?? [];
		const hasDelete = actionsForKey.some((a) => a.action === "delete");
		if (!hasDelete) {
			filtered.push(action);
			continue;
		}
		if (action.action === "delete" || action.action === "install") filtered.push(action);
	}
	return filtered;
}

function applyEmptyDirOverride(
	actions: ReconcileAction[],
	dirStates: TargetDirectoryState[],
	respectDeletions: boolean,
): { actions: ReconcileAction[]; banners: ReconcileBanner[] } {
	if (dirStates.length === 0) return { actions, banners: [] };

	const dirIndex = buildDirStateIndex(dirStates);
	const banners: ReconcileBanner[] = [];
	const flippedGroups = new Map<string, { dirState: TargetDirectoryState; count: number }>();

	for (const action of actions) {
		if (action.action !== "skip" || action.reasonCode !== "user-deleted-respected") continue;

		const key = makeDirStateKey(action.provider, action.type, action.global);
		const dirState = dirIndex.get(key);
		if (!dirState?.isEmpty) continue;

		if (respectDeletions) {
			const existing = flippedGroups.get(key);
			if (existing) existing.count++;
			else flippedGroups.set(key, { dirState, count: 1 });
			continue;
		}

		action.action = "install";
		action.reasonCode = "target-dir-empty-reinstall";
		action.reasonCopy = getReasonCopy("target-dir-empty-reinstall");
		action.reason = action.reasonCopy;

		const existing = flippedGroups.get(key);
		if (existing) existing.count++;
		else flippedGroups.set(key, { dirState, count: 1 });
	}

	for (const [, { dirState, count }] of flippedGroups) {
		if (respectDeletions) {
			banners.push({
				kind: "empty-dir-respected",
				provider: dirState.provider, type: dirState.type, global: dirState.global,
				path: dirState.path, itemCount: count,
				message: `Detected empty ${dirState.path} — respecting your deletions (${count} items skipped).`,
			});
		} else {
			banners.push({
				kind: "empty-dir",
				provider: dirState.provider, type: dirState.type, global: dirState.global,
				path: dirState.path, itemCount: count,
				message: `Detected empty ${dirState.path} — ${count} item${count === 1 ? "" : "s"} will be reinstalled. Uncheck any to skip.`,
			});
		}
	}

	return { actions, banners };
}

export function reconcile(input: ReconcileInput): ReconcilePlan {
	const actions: ReconcileAction[] = [];
	const targetStateIndex = buildTargetStateIndex(input.targetStates);
	const uniqueProviderConfigs = dedupeProviderConfigs(input.providerConfigs);
	const deletedIdentityKeys = new Set<string>();

	for (const sourceItem of input.sourceItems) {
		for (const providerConfig of uniqueProviderConfigs) {
			actions.push(
				determineAction(sourceItem, providerConfig, input, targetStateIndex, deletedIdentityKeys),
			);
		}
	}

	actions.push(...detectOrphans(input));

	const normalizedActions = suppressOverlappingActions(dedupeActions(actions));
	const dirStates = input.typeDirectoryStates ?? [];
	const respectDeletions = input.respectDeletions ?? false;
	const { actions: finalActions, banners } = applyEmptyDirOverride(
		normalizedActions, dirStates, respectDeletions,
	);

	return buildPlan(finalActions, banners);
}

function determineAction(
	source: SourceItemState,
	providerConfig: ReconcileProviderInput,
	input: ReconcileInput,
	targetStateIndex: Map<string, TargetFileState>,
	deletedIdentityKeys: Set<string>,
): ReconcileAction {
	let registryEntry = findRegistryEntry(source, providerConfig, input.registry);
	const identityKey = makeRegistryIdentityKey({
		item: source.item, type: source.type,
		provider: providerConfig.provider, global: providerConfig.global,
	});
	if (registryEntry && deletedIdentityKeys.has(identityKey)) registryEntry = null;

	const isDirectoryItem = source.type === "skill";

	const common = {
		item: source.item,
		type: source.type,
		provider: providerConfig.provider,
		global: providerConfig.global,
		targetPath: "",
		isDirectoryItem: isDirectoryItem || undefined,
	};

	const convertedChecksumRaw = source.convertedChecksums[providerConfig.provider];
	const convertedChecksum = normalizeChecksum(convertedChecksumRaw);
	const expectedTargetChecksum = getExpectedTargetChecksum(source, providerConfig.provider);

	if (!convertedChecksumRaw || isUnknownChecksum(convertedChecksumRaw)) {
		if (registryEntry) {
			common.targetPath = registryEntry.path;
			const code: ReconcileReason = "provider-checksum-unavailable";
			return {
				...common, action: "skip",
				reason: "Provider checksum unavailable — cannot verify safely",
				reasonCode: code, reasonCopy: getReasonCopy(code),
				sourceChecksum: UNKNOWN_CHECKSUM,
				registeredSourceChecksum: normalizeChecksum(registryEntry.sourceChecksum),
				registeredTargetChecksum: normalizeChecksum(registryEntry.targetChecksum),
			};
		}

		const itemExistsElsewhere = input.registry.installations.some(
			(i) => i.item === source.item && i.type === source.type,
		);
		const code: ReconcileReason = itemExistsElsewhere ? "new-provider-for-item" : "new-item";
		return {
			...common, action: "install",
			reason: itemExistsElsewhere ? "New provider for existing item" : "New item, not previously installed",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: UNKNOWN_CHECKSUM,
		};
	}

	if (!registryEntry) {
		const itemExistsElsewhere = input.registry.installations.some(
			(i) => i.item === source.item && i.type === source.type,
		);
		const code: ReconcileReason = itemExistsElsewhere ? "new-provider-for-item" : "new-item";
		return {
			...common, action: "install",
			reason: itemExistsElsewhere ? "New provider for existing item" : "New item, not previously installed",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum,
		};
	}

	common.targetPath = registryEntry.path;
	const registeredSourceChecksum = normalizeChecksum(registryEntry.sourceChecksum);
	const registeredTargetChecksum = normalizeChecksum(registryEntry.targetChecksum);
	const targetState = lookupTargetState(targetStateIndex, registryEntry.path);
	const currentTargetChecksum = getCurrentTargetChecksum(targetState, registryEntry);
	const targetMatchesExpectedOutput =
		targetState?.exists === true &&
		!isUnknownChecksum(expectedTargetChecksum) &&
		currentTargetChecksum === expectedTargetChecksum;

	if (isUnknownChecksum(registeredSourceChecksum)) {
		if (targetMatchesExpectedOutput) {
			const code: ReconcileReason = "target-up-to-date-backfill";
			return {
				...common, action: "skip",
				reason: "Target up-to-date after registry upgrade — checksums will be backfilled",
				reasonCode: code, reasonCopy: getReasonCopy(code),
				sourceChecksum: convertedChecksum, currentTargetChecksum, backfillRegistry: true,
			};
		}
		if (!targetState || !targetState.exists) {
			const code: ReconcileReason = "registry-upgrade-reinstall";
			return {
				...common, action: "install",
				reason: "Target deleted — reinstalling after registry upgrade",
				reasonCode: code, reasonCopy: getReasonCopy(code),
				sourceChecksum: convertedChecksum,
			};
		}
		const code: ReconcileReason = "registry-upgrade-heal";
		return {
			...common, action: "update",
			reason: "Healing stale target after registry upgrade",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, currentTargetChecksum,
		};
	}

	if (
		targetMatchesExpectedOutput &&
		(convertedChecksum !== registeredSourceChecksum ||
			currentTargetChecksum !== registeredTargetChecksum)
	) {
		const code: ReconcileReason = "target-up-to-date-backfill";
		return {
			...common, action: "skip",
			reason: "Target up-to-date — registry checksums will be backfilled",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, registeredSourceChecksum,
			currentTargetChecksum, registeredTargetChecksum, backfillRegistry: true,
		};
	}

	const sourceChanged = convertedChecksum !== registeredSourceChecksum;
	const targetChangeState = getTargetChangeState(targetState, registryEntry, registeredTargetChecksum);

	if (targetChangeState === "deleted") {
		const forceReinstall = input.force && !sourceChanged;

		if (sourceChanged) {
			const code: ReconcileReason = "target-deleted-source-changed";
			return {
				...common, action: "install",
				reason: "Target was deleted, mewkit has updates — reinstalling",
				reasonCode: code, reasonCopy: getReasonCopy(code),
				sourceChecksum: convertedChecksum, registeredSourceChecksum,
			};
		}

		if (forceReinstall) {
			const code: ReconcileReason = "force-reinstall";
			return {
				...common, action: "install",
				reason: "Force reinstall (target was deleted)",
				reasonCode: code, reasonCopy: getReasonCopy(code),
				sourceChecksum: convertedChecksum, registeredSourceChecksum,
			};
		}

		const code: ReconcileReason = "user-deleted-respected";
		return {
			...common, action: "skip",
			reason: "Target was deleted by user, mewkit unchanged — respecting deletion",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, registeredSourceChecksum,
		};
	}

	if (targetChangeState === "unknown") {
		const code: ReconcileReason = sourceChanged
			? "target-state-unknown-source-changed"
			: "target-state-unknown";
		return {
			...common,
			action: sourceChanged ? "conflict" : "skip",
			reason: sourceChanged
				? "Target state unavailable while mewkit changed — manual review required"
				: "Target state unavailable, mewkit unchanged — preserving target",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, registeredSourceChecksum,
			currentTargetChecksum, registeredTargetChecksum,
		};
	}

	const targetChanged = targetChangeState === "changed";

	if (!sourceChanged && !targetChanged) {
		const code: ReconcileReason = "no-changes";
		return {
			...common, action: "skip", reason: "No changes",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, currentTargetChecksum,
		};
	}

	if (!sourceChanged && targetChanged) {
		if (input.force) {
			return {
				...common, action: "install",
				reason: "Force overwrite (user edits)",
				reasonCode: "force-overwrite",
				reasonCopy: getReasonCopy("force-overwrite"),
				sourceChecksum: convertedChecksum, registeredSourceChecksum,
				currentTargetChecksum, registeredTargetChecksum,
			};
		}
		const code: ReconcileReason = "user-edits-preserved";
		return {
			...common, action: "skip",
			reason: "User edited, mewkit unchanged — preserving edits",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, registeredSourceChecksum,
			currentTargetChecksum, registeredTargetChecksum,
		};
	}

	if (sourceChanged && !targetChanged) {
		const code: ReconcileReason = "source-changed";
		return {
			...common, action: "update",
			reason: "mewkit updated, no user edits — safe overwrite",
			reasonCode: code, reasonCopy: getReasonCopy(code),
			sourceChecksum: convertedChecksum, registeredSourceChecksum,
			currentTargetChecksum, registeredTargetChecksum,
		};
	}

	const code: ReconcileReason = "both-changed";
	return {
		...common, action: "conflict",
		reason: "Both mewkit and user modified this item",
		reasonCode: code, reasonCopy: getReasonCopy(code),
		sourceChecksum: convertedChecksum, registeredSourceChecksum,
		currentTargetChecksum, registeredTargetChecksum,
	};
}

function findRegistryEntry(
	source: SourceItemState,
	providerConfig: ReconcileProviderInput,
	registry: { installations: PortableInstallationV3[] },
): PortableInstallationV3 | null {
	const exactMatch =
		registry.installations.find(
			(i) =>
				i.item === source.item &&
				i.type === source.type &&
				i.provider === providerConfig.provider &&
				i.global === providerConfig.global,
		) || null;
	if (exactMatch) return exactMatch;

	if (source.type === "config") {
		return (
			registry.installations.find(
				(i) =>
					i.type === "config" &&
					i.provider === providerConfig.provider &&
					i.global === providerConfig.global,
			) || null
		);
	}

	return null;
}

function detectOrphans(input: ReconcileInput): ReconcileAction[] {
	const actions: ReconcileAction[] = [];
	const sourceItemKeys = new Set(input.sourceItems.map((s) => makeItemTypeKey(s.item, s.type)));
	const activeProviderKeys = new Set(
		input.providerConfigs.map((p) => makeProviderConfigKey(p.provider, p.global)),
	);
	const hasConfigSource = input.sourceItems.some((s) => s.type === "config");

	for (const entry of input.registry.installations) {
		const sourceItemKey = makeItemTypeKey(entry.item, entry.type);
		const providerKey = makeProviderConfigKey(entry.provider, entry.global);

		if (!activeProviderKeys.has(providerKey)) continue;
		if (entry.installSource === "manual") continue;
		if (entry.type === "skill") continue;
		if (entry.type === "config" && hasConfigSource) continue;

		if (!sourceItemKeys.has(sourceItemKey)) {
			const code: ReconcileReason = "source-removed-orphan";
			actions.push({
				action: "delete",
				item: entry.item, type: entry.type, provider: entry.provider, global: entry.global,
				targetPath: entry.path,
				reason: "Item no longer in mewkit source — orphaned",
				reasonCode: code, reasonCopy: getReasonCopy(code),
			});
		}
	}

	return actions;
}

function buildPlan(actions: ReconcileAction[], banners: ReconcileBanner[]): ReconcilePlan {
	const summary = { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 };
	for (const action of actions) summary[action.action]++;

	return { actions, summary, hasConflicts: summary.conflict > 0, banners };
}
