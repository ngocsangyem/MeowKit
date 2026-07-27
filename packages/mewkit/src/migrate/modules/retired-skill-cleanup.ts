// Checksum-gated cleanup of a managed skill directory the bundle no longer ships.
//
// Normal reconciliation only walks the CURRENTLY selected manifest entries, so a skill that
// was installed by an older bundle and has since been retired is never revisited: its
// directory and its ledger row both survive the upgrade forever. That leaves two entry
// points for the same capability on disk, which is exactly the ambiguity a rename is meant
// to remove.
//
// This module closes that gap for the one narrow case where deletion is provably safe:
// a ledger row this toolkit wrote, pointing at a direct child of the provider's skills root,
// whose recorded source directory is absent from the current authored bundle, and whose
// installed tree still checksum-matches what the ledger says was installed. Anything
// else — a modified copy, an unreadable tree, a missing provenance row, a symlink, a path
// that escapes the skills root — is PRESERVED and reported. `--force` does not widen this:
// force may overwrite a currently managed item, but it never converts an unproven directory
// into an automatic deletion.
//
// Retirement is derived from the FULL authored skill set on disk, never from the selected
// pack. Installing a narrower pack must not read as "everything else was retired".
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { computeTreeChecksum } from "../reconcile/checksum-utils.js";
import type { PortableInstallationV3, PortableRegistryV3 } from "../reconcile/portable-registry.js";
import {
	getReasonCopy,
	isUnknownChecksum,
	type ReconcileActionType,
	type ReconcileReason,
} from "../reconcile/reconcile-types.js";

/** The two provider-specific facts this cleanup needs. Everything else is shared. */
export interface RetiredSkillProvider {
	provider: PortableInstallationV3["provider"];
	/** Manifest-relative prefix of the bundle's skills tree, e.g. `root/.agents/skills`. */
	sourceSkillsPrefix: string;
	/** Target-relative skills root, e.g. `.agents/skills`. */
	targetSkillsRoot: string;
}

export interface RetiredSkillOutcome {
	/** Absolute path of the installed directory the ledger row points at. */
	path: string;
	/** Skill directory name — the user-facing identity in the report. */
	skill: string;
	action: Extract<ReconcileActionType, "delete" | "skip">;
	reasonCode: ReconcileReason;
	reason: string;
	/** True only when this run actually removed the directory from disk. */
	removed: boolean;
	/** True when this run dropped the ledger row (a removal, or a benign absent target). */
	ledgerRowRemoved: boolean;
}

export interface RetiredSkillCleanupInput {
	ledger: PortableRegistryV3;
	/** Root of the authored bundle (the directory holding `manifest.json`). */
	moduleDir: string;
	/** Root the bundle was installed into. */
	targetDir: string;
	config: RetiredSkillProvider;
	/** Plan only — compute outcomes, touch neither disk nor ledger. */
	dryRun?: boolean;
	/** Called after each ledger row is dropped, so a provider with per-entry durability can
	 *  flush immediately instead of once at the end. */
	onLedgerRowRemoved?: () => Promise<void>;
}

/** Skill directory names the authored bundle currently ships, or null when the tree is absent. */
function authoredSkillDirs(moduleDir: string, sourceSkillsPrefix: string): Set<string> | null {
	const root = join(moduleDir, sourceSkillsPrefix);
	if (!existsSync(root) || !statSync(root).isDirectory()) return null;
	return new Set(
		readdirSync(root, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name),
	);
}

/** `childAbsPath` is a DIRECT child of `parentAbsPath` — one segment down, no traversal. */
function isDirectChild(parentAbsPath: string, childAbsPath: string): boolean {
	const rel = relative(resolve(parentAbsPath), resolve(childAbsPath));
	return rel !== "" && !rel.startsWith("..") && !rel.includes(sep);
}

/**
 * The skill name a ledger row's `sourcePath` names, when that path is exactly one segment
 * under the bundle's skills prefix. Anything deeper, shallower, or outside returns null —
 * the row did not come from a per-skill bundle entry and is not a retirement candidate.
 */
function retiredSkillNameFromSourcePath(sourcePath: string, sourceSkillsPrefix: string): string | null {
	const normalizedPrefix = sourceSkillsPrefix.replace(/\/+$/, "");
	const parts = sourcePath.split("/").filter(Boolean);
	const prefixParts = normalizedPrefix.split("/").filter(Boolean);
	if (parts.length !== prefixParts.length + 1) return null;
	for (const [i, part] of prefixParts.entries()) if (parts[i] !== part) return null;
	const name = parts[parts.length - 1];
	return name && name !== "." && name !== ".." ? name : null;
}

function outcome(
	path: string,
	skill: string,
	action: RetiredSkillOutcome["action"],
	reasonCode: ReconcileReason,
	removed: boolean,
	ledgerRowRemoved: boolean,
): RetiredSkillOutcome {
	return { path, skill, action, reasonCode, reason: getReasonCopy(reasonCode), removed, ledgerRowRemoved };
}

/**
 * Remove every provably-pristine retired skill directory, preserve and report the rest.
 *
 * Mutates `ledger` in place when a row is dropped (and `dryRun` is not set); the caller owns
 * persisting it. Returns one outcome per candidate — an empty array means the installed tree
 * carries nothing this bundle has retired.
 */
export async function reconcileRetiredSkills(input: RetiredSkillCleanupInput): Promise<RetiredSkillOutcome[]> {
	const { ledger, moduleDir, targetDir, config, dryRun } = input;

	// No readable authored skills tree means we cannot prove ANYTHING was retired. Bail
	// rather than treat an unreadable source as "the bundle ships no skills".
	const authored = authoredSkillDirs(moduleDir, config.sourceSkillsPrefix);
	if (!authored || authored.size === 0) return [];

	const skillsRootAbs = resolve(join(targetDir, config.targetSkillsRoot));
	if (!existsSync(skillsRootAbs)) return [];

	// Realpath the root once so a candidate's realpath can be checked against it. A skills
	// root that is itself a symlink is legitimate; a CHILD escaping it is not.
	let skillsRootReal: string;
	try {
		skillsRootReal = realpathSync(skillsRootAbs);
	} catch {
		return [];
	}

	const outcomes: RetiredSkillOutcome[] = [];
	const rowsToDrop: PortableInstallationV3[] = [];

	for (const row of ledger.installations) {
		if (row.provider !== config.provider) continue;
		if (!row.sourcePath || !row.path) continue;

		const skill = retiredSkillNameFromSourcePath(row.sourcePath, config.sourceSkillsPrefix);
		if (!skill) continue;
		// Still shipped — this is a normal managed item, not a retirement.
		if (authored.has(skill)) continue;

		const targetAbs = resolve(row.path);
		// The row must point at a direct child of THIS project's skills root, and the
		// directory name must agree with the source it claims to come from. Neither a
		// deeper path, a sibling tree, nor the root itself is ever a candidate.
		if (!isDirectChild(skillsRootAbs, targetAbs) || basename(targetAbs) !== skill) continue;
		if (resolve(dirname(targetAbs)) !== skillsRootAbs) continue;

		if (!existsSync(targetAbs)) {
			// Already gone. Dropping the stale row is the recovery path for a crash between
			// the directory removal and the ledger flush: absent target, absent row, no
			// resurrection of content the previous run deliberately deleted.
			if (!dryRun) rowsToDrop.push(row);
			outcomes.push(outcome(targetAbs, skill, "delete", "source-removed-orphan", false, !dryRun));
			continue;
		}

		// A symlink is never removed: deleting it is either a no-op on the real content or a
		// deletion of something outside the tree we are allowed to touch.
		let stats: ReturnType<typeof lstatSync>;
		try {
			stats = lstatSync(targetAbs);
		} catch {
			outcomes.push(outcome(targetAbs, skill, "skip", "target-state-unknown", false, false));
			continue;
		}
		if (stats.isSymbolicLink() || !stats.isDirectory()) {
			outcomes.push(outcome(targetAbs, skill, "skip", "target-state-unknown", false, false));
			continue;
		}
		try {
			const real = realpathSync(targetAbs);
			if (!isDirectChild(skillsRootReal, real)) {
				outcomes.push(outcome(targetAbs, skill, "skip", "target-state-unknown", false, false));
				continue;
			}
		} catch {
			outcomes.push(outcome(targetAbs, skill, "skip", "target-state-unknown", false, false));
			continue;
		}

		// Without a recorded baseline there is nothing to compare against, so nothing is proven.
		if (isUnknownChecksum(row.targetChecksum)) {
			outcomes.push(outcome(targetAbs, skill, "skip", "provider-checksum-unavailable", false, false));
			continue;
		}

		let currentChecksum: string;
		try {
			currentChecksum = await computeTreeChecksum(targetAbs);
		} catch {
			outcomes.push(outcome(targetAbs, skill, "skip", "target-state-unknown", false, false));
			continue;
		}

		// Caveat on "pristine": the tree checksum walks only regular files and directories,
		// so a symlink nested INSIDE the candidate is not part of the hash and cannot make
		// the comparison fail. That is not a deletion hazard — the recursive remove unlinks a
		// nested symlink rather than following it, so nothing outside the tree is reachable —
		// but the match proves the tracked file content is unchanged, not that the directory
		// is byte-for-byte as installed.
		if (currentChecksum !== row.targetChecksum) {
			// User work. Preserve it byte-for-byte and surface it; the conflict report IS the
			// intended handoff, not a cleanup failure.
			outcomes.push(outcome(targetAbs, skill, "skip", "user-edits-preserved", false, false));
			continue;
		}

		if (!dryRun) {
			// Recursive, but scoped to one proven skill directory — never a parent, never the
			// skills root. Directory removal precedes the row drop so an interruption leaves an
			// absent target with a live row, which the branch above reconciles benignly.
			rmSync(targetAbs, { recursive: true, force: false });
			rowsToDrop.push(row);
		}
		outcomes.push(outcome(targetAbs, skill, "delete", "source-removed-orphan", !dryRun, !dryRun));
	}

	for (const row of rowsToDrop) {
		const idx = ledger.installations.indexOf(row);
		if (idx >= 0) ledger.installations.splice(idx, 1);
		if (input.onLedgerRowRemoved) await input.onLedgerRowRemoved();
	}

	return outcomes;
}

/**
 * Human-facing lines for a cleanup result, or an empty array when there is nothing to say.
 * A preserved directory is always named: silently leaving a retired copy on disk is exactly
 * the ambiguity this cleanup exists to surface.
 */
export function describeRetiredSkills(outcomes: RetiredSkillOutcome[], dryRun = false): string[] {
	const removed = outcomes.filter((o) => o.action === "delete");
	const preserved = outcomes.filter((o) => o.action === "skip");
	const lines: string[] = [];
	if (removed.length > 0) {
		const verb = dryRun ? "would be removed" : "removed";
		lines.push(`${removed.length} retired skill dir(s) ${verb}: ${removed.map((o) => o.skill).join(", ")}`);
	}
	for (const o of preserved) {
		lines.push(`retired skill "${o.skill}" kept at ${o.path} — ${o.reason}`);
	}
	return lines;
}
