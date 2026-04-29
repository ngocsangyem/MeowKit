// Vendored from claudekit-cli (MIT). Source: src/commands/portable/reconcile-types.ts
// Pure types for idempotent migration planning. Manifest type loosened (mewkit defers
// rename/path-migration to a follow-up; structure preserved for forward compat).

import type { PortableRegistryV3 } from "./portable-registry.js";

export const UNKNOWN_CHECKSUM = "unknown" as const;

export function normalizeChecksum(checksum: string | undefined | null): string {
	if (!checksum) return UNKNOWN_CHECKSUM;
	const trimmed = checksum.trim();
	if (!trimmed) return UNKNOWN_CHECKSUM;
	if (trimmed.toLowerCase() === UNKNOWN_CHECKSUM) return UNKNOWN_CHECKSUM;
	return trimmed;
}

export function isUnknownChecksum(checksum: string | undefined | null): boolean {
	return normalizeChecksum(checksum) === UNKNOWN_CHECKSUM;
}

export type ReconcileReason =
	| "new-item"
	| "new-provider-for-item"
	| "target-deleted-source-changed"
	| "target-dir-empty-reinstall"
	| "force-reinstall"
	| "force-overwrite"
	| "registry-upgrade-reinstall"
	| "source-changed"
	| "registry-upgrade-heal"
	| "no-changes"
	| "user-edits-preserved"
	| "user-deleted-respected"
	| "target-up-to-date-backfill"
	| "provider-checksum-unavailable"
	| "target-state-unknown"
	| "source-removed-orphan"
	| "renamed-cleanup"
	| "path-migrated-cleanup"
	| "both-changed"
	| "target-state-unknown-source-changed";

export function getReasonCopy(code: ReconcileReason, _ctx?: Record<string, string>): string {
	switch (code) {
		case "new-item": return "New — not previously installed";
		case "new-provider-for-item": return "New provider for existing item";
		case "target-deleted-source-changed": return "You deleted this; mewkit has updates — reinstalling";
		case "target-dir-empty-reinstall": return "Provider directory is empty — reinstalling";
		case "force-reinstall": return "Force reinstall (target was deleted)";
		case "force-overwrite": return "Force overwrite (you edited this, --force active)";
		case "registry-upgrade-reinstall": return "Target deleted — reinstalling after registry upgrade";
		case "source-changed": return "mewkit updated, you didn't edit — safe to overwrite";
		case "registry-upgrade-heal": return "Healing stale target after registry upgrade";
		case "no-changes": return "Already up to date";
		case "user-edits-preserved": return "You edited this, mewkit unchanged — keeping your edits";
		case "user-deleted-respected": return "You deleted this, mewkit unchanged — respecting your choice";
		case "target-up-to-date-backfill": return "Already up to date — registry checksums will be backfilled";
		case "provider-checksum-unavailable": return "Provider checksum unavailable — cannot verify safely";
		case "target-state-unknown": return "Target state unavailable, mewkit unchanged — preserving target";
		case "source-removed-orphan": return "No longer shipped by mewkit — will be removed";
		case "renamed-cleanup": return "Renamed — cleaning up old path";
		case "path-migrated-cleanup": return "Path migrated — cleaning up old location";
		case "both-changed": return "Both you and mewkit changed this — pick one";
		case "target-state-unknown-source-changed": return "Target state unavailable while mewkit changed — manual review required";
	}
}

export type ReconcileActionType = "install" | "update" | "skip" | "conflict" | "delete";

export type ConflictResolution =
	| { type: "overwrite" }
	| { type: "keep" }
	| { type: "smart-merge" }
	| { type: "resolved"; content: string };

export interface ReconcileAction {
	action: ReconcileActionType;
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	provider: string;
	global: boolean;
	targetPath: string;
	reason: string;
	reasonCode?: ReconcileReason;
	reasonCopy?: string;
	isDirectoryItem?: boolean;
	sourceChecksum?: string;
	registeredSourceChecksum?: string;
	currentTargetChecksum?: string;
	registeredTargetChecksum?: string;
	backfillRegistry?: boolean;
	previousItem?: string;
	previousPath?: string;
	cleanupPaths?: string[];
	ownedSections?: string[];
	affectedSections?: string[];
	diff?: string;
	resolution?: ConflictResolution;
}

export interface SourceItemState {
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	sourceChecksum: string;
	convertedChecksums: Record<string, string>;
	targetChecksums?: Record<string, string>;
}

export interface TargetFileState {
	path: string;
	exists: boolean;
	currentChecksum?: string;
	sectionChecksums?: Record<string, string>;
}

export interface TargetDirectoryState {
	provider: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	global: boolean;
	path: string;
	exists: boolean;
	isEmpty: boolean;
	fileCount: number;
}

export interface ReconcileBanner {
	kind: "empty-dir" | "empty-dir-respected";
	provider: string;
	type: string;
	global: boolean;
	path: string;
	itemCount: number;
	message: string;
}

export interface ReconcileProviderInput {
	provider: string;
	global: boolean;
}

/** Manifest shape for renames/path migrations. Loose for v1; tighten when implemented. */
export interface PortableManifest {
	renames?: Array<{ from: string; to: string; type: string }>;
	pathMigrations?: Array<{ from: string; to: string; type: string }>;
	[key: string]: unknown;
}

export interface ReconcileInput {
	sourceItems: SourceItemState[];
	registry: PortableRegistryV3;
	targetStates: Map<string, TargetFileState>;
	manifest?: PortableManifest | null;
	providerConfigs: ReconcileProviderInput[];
	force?: boolean;
	typeDirectoryStates?: TargetDirectoryState[];
	respectDeletions?: boolean;
}

export interface ReconcilePlan {
	actions: ReconcileAction[];
	summary: {
		install: number;
		update: number;
		skip: number;
		conflict: number;
		delete: number;
	};
	hasConflicts: boolean;
	banners: ReconcileBanner[];
}
