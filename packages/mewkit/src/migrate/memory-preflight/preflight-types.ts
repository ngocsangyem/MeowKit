// Shared types for the legacy-memory preflight (discover → classify → inventory →
// plan). Pure planning: nothing here or downstream mutates the filesystem; the
// transaction that acts on this plan lives in phase 3.
import type { StoreSpec } from "../../memory/schemas.js";

/** Runtime-neutral taxonomy classes + the lossless catch-all (`legacy`) and the
 *  `retain` marker for tracked files (`.gitkeep`) that stay in `.claude/memory/`. */
export type TargetClass = "memory" | "telemetry" | "state" | "cache" | "legacy" | "retain";

/** Per-file validation outcome. `symlink` entries are recorded but never staged. */
export type ValidationState = "valid" | "invalid" | "symlink" | "unchecked" | "skipped";

/** Planned action. `stage`/`quarantine` mutate on execute; the rest are inert. */
export type PreflightAction = "stage" | "noop" | "conflict" | "quarantine" | "skip";

export interface Classification {
	targetClass: TargetClass;
	/** Destination path relative to `.meowkit/` (e.g. "memory/fixes.json"); empty for `retain`. */
	targetRelPath: string;
	/** Set when this is a curated JSON store whose content must be schema-validated. */
	curatedStore?: StoreSpec;
}

export interface InventoryEntry {
	/** Path relative to the legacy root (`.claude/memory/`). */
	relPath: string;
	/** Absolute source path. */
	sourcePath: string;
	targetClass: TargetClass;
	/** Destination relative to `.meowkit/`; empty for retained files. */
	targetRelPath: string;
	size: number;
	/** sha256 of the source; null for symlinks / retained markers. */
	checksum: string | null;
	validationState: ValidationState;
	action: PreflightAction;
	note?: string;
}

export interface PreflightResult {
	legacyRoot: string;
	meowkitRoot: string;
	/** Every discovered entry, stable-sorted by relPath. */
	inventory: InventoryEntry[];
	/** Entries whose action mutates on execute (`stage` | `quarantine`). */
	actions: InventoryEntry[];
	/** Entries where source and an existing target differ (never overwritten silently). */
	conflicts: InventoryEntry[];
	/** True when nothing needs staging AND there are no conflicts (already-migrated). */
	noop: boolean;
}

export interface PreflightOptions {
	/** Override the target `.meowkit/` root (defaults to `<projectRoot>/.meowkit`). */
	meowkitRoot?: string;
}
