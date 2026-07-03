// Aggregation: fold the migration run's already-scattered signals into a single
// list of per-artifact `MigrationDecisionRecord`s for the run-report ledger. This
// is pure aggregation — no new detection. The identity invariant the report relies
// on (migrated + skipped + failed == discovered artifacts) is guaranteed here by
// emitting exactly one PRIMARY record per discovered artifact, with Phase 1-3
// sub-signals (preserved references, waivers, audit failures) enriching — never
// inflating — those primary records.

import { classifyEnvReference } from "../references/reference-classifier.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";
import type { DiscoveredItems } from "../migrate-discover.js";
import type { PortableType, ProviderType } from "../types.js";
import type { MigrationDecisionRecord, MigrationOutcome } from "./migration-record-types.js";

/** One discovered source artifact, normalized for record building. */
interface DiscoveredArtifact {
	source: string;
	type: PortableType;
}

/**
 * Enumerate every discovered source artifact as `{source, type}`. This is the
 * identity-check denominator: every entry here becomes exactly one primary record.
 * Shell hooks filtered out at discovery are included as skipped artifacts so the
 * dropped-safety-hook loss (gate-enforcement, privacy-block, …) is never silent.
 */
export function enumerateDiscoveredArtifacts(discovered: DiscoveredItems): DiscoveredArtifact[] {
	const artifacts: DiscoveredArtifact[] = [];
	for (const a of discovered.agents) artifacts.push({ source: a.name, type: "agent" });
	for (const c of discovered.commands) artifacts.push({ source: c.name, type: "command" });
	for (const r of discovered.rules) artifacts.push({ source: r.name, type: "rules" });
	if (discovered.config) artifacts.push({ source: discovered.config.name, type: "config" });
	for (const s of discovered.skills) artifacts.push({ source: s.name, type: "skill" });
	for (const h of discovered.hooks) artifacts.push({ source: h.name, type: "hooks" });
	for (const shellHook of discovered.skippedShellHooks) artifacts.push({ source: shellHook, type: "hooks" });
	return artifacts;
}

/**
 * Index install results by the artifact they installed. Bulk shims (codex agents /
 * hooks) carry aggregate item labels, so per-artifact outcomes come from the
 * explicit `installedArtifacts` map the orchestrator threads alongside, not from
 * the shim label.
 */
export interface RunOutcome {
	outcome: "migrated" | "failed";
	target?: string;
	/** Present when outcome === "failed" — the raw installer error message. */
	error?: string;
	/** True when the failure came from an internal (non-audit) installer exception. */
	internalError?: boolean;
}

export interface BuildRunRecordsInput {
	discovered: DiscoveredItems;
	provider: ProviderType;
	/** Per-artifact outcome keyed by `${type}:${source}` (from the orchestrator). */
	outcomes: Map<string, RunOutcome>;
	/** Structured records emitted by Phase 1-3 producers (skills, hooks, references). */
	phaseRecords: readonly MigrationDecisionRecord[];
	/** Preserved-with-warning reference occurrences (from the conversion report). */
	preservedOccurrences: readonly ReferenceOccurrence[];
}

function outcomeKey(type: PortableType, source: string): string {
	return `${type}:${source}`;
}

/** Human reason for a run outcome, routing `.env` references through the new classifier. */
function reasonForOutcome(outcome: RunOutcome): { reason: MigrationDecisionRecord["reason"]; detail?: string } {
	if (outcome.outcome === "migrated") return { reason: "converted" };
	const detail = outcome.internalError ? `internal-error: ${outcome.error ?? "unknown"}` : outcome.error;
	return { reason: "conversion-error", detail };
}

/**
 * Reclassify a preserved occurrence's report reason: a `.claude/.env` reference now
 * points at the emitted [shell_environment_policy] scaffold instead of the stale
 * "no provider equivalent" phrase. Item D — routed ONLY here (report-reason layer),
 * never in the rewriter's decision rules.
 */
export function reportReasonForOccurrence(occurrence: ReferenceOccurrence): string {
	const envReason = classifyEnvReference(occurrence.original);
	if (envReason) return envReason.reason;
	return occurrence.reason ?? "reference preserved";
}

/** Owning artifact key for an occurrence whose `file` is a `provider/type/item…` path. */
function occurrenceArtifact(occurrence: ReferenceOccurrence): { type: PortableType; source: string } | null {
	// Occurrence file forms produced by the conversion pass:
	//   `<provider>/<type>/<item>`                     (agents, commands, rules, config)
	//   `<provider>/skill/<skillName>/<relPath>`       (skill files)
	const parts = occurrence.file.split("/");
	if (parts.length < 3) return null;
	const type = parts[1];
	if (type === "skill") return { type: "skill", source: parts[2] };
	if (type === "agent" || type === "command" || type === "rules" || type === "config" || type === "hooks") {
		return { type, source: parts[2] };
	}
	return null;
}

/**
 * Build the complete per-discovered-artifact record list. Exactly one primary
 * record per discovered artifact (identity invariant). Phase records that carry a
 * more severe outcome for the same artifact escalate the primary record's status;
 * preserved occurrences attach as enrichment on the owning primary record.
 */
export function buildRunRecords(input: BuildRunRecordsInput): MigrationDecisionRecord[] {
	const OUTCOME_SEVERITY: Record<MigrationOutcome, number> = { migrated: 0, skipped: 1, partial: 2, failed: 3 };
	const primary = new Map<string, MigrationDecisionRecord>();

	// 1. One primary record per discovered artifact.
	for (const artifact of enumerateDiscoveredArtifacts(input.discovered)) {
		const key = outcomeKey(artifact.type, artifact.source);
		const outcome = input.outcomes.get(key);
		let record: MigrationDecisionRecord;
		if (!outcome) {
			// No install attempt reached this artifact (filtered by portability policy,
			// no provider surface, or a skipped shell hook): a deliberate skip.
			record = {
				source: artifact.source,
				type: artifact.type,
				provider: input.provider,
				outcome: "skipped",
				reason: artifact.type === "hooks" ? "event-unsupported" : "no-provider-surface",
			};
		} else {
			const { reason, detail } = reasonForOutcome(outcome);
			record = {
				source: artifact.source,
				type: artifact.type,
				provider: input.provider,
				outcome: outcome.outcome,
				reason,
			};
			if (detail) record.detail = detail;
			if (outcome.target) record.target = outcome.target;
		}
		primary.set(key, record);
	}

	// 2. Escalate primary outcomes from Phase 1-3 records. Skill/hook sub-records use
	//    per-file `source` paths; map them back to their owning discovered artifact.
	const dirNameToSkillName = new Map(input.discovered.skills.map((s) => [s.dirName, s.name]));
	for (const rec of input.phaseRecords) {
		const owner = phaseRecordOwner(rec, dirNameToSkillName);
		if (!owner) continue;
		const key = outcomeKey(owner.type, owner.source);
		const existing = primary.get(key);
		if (!existing) continue;
		if (OUTCOME_SEVERITY[rec.outcome] > OUTCOME_SEVERITY[existing.outcome]) {
			existing.outcome = rec.outcome;
			existing.reason = rec.reason;
			if (rec.detail) existing.detail = rec.detail;
		}
	}

	// 3. Attach preserved occurrences to their owning primary record for file:line detail.
	for (const occ of input.preservedOccurrences) {
		const owner = occurrenceArtifact(occ);
		if (!owner) continue;
		const existing = primary.get(outcomeKey(owner.type, owner.source));
		if (!existing) continue;
		const enriched: ReferenceOccurrence = { ...occ, reason: reportReasonForOccurrence(occ) };
		existing.occurrences = [...(existing.occurrences ?? []), enriched];
	}

	return Array.from(primary.values());
}

/**
 * Resolve which discovered artifact a Phase 1-3 sub-record belongs to. Skill
 * sub-records carry `source: .claude/skills/<dirName>/<file>`; hook records carry
 * the hook file name directly. The dirName is matched against discovered skill
 * dirNames so the owner key aligns with the primary record's `source` (skill.name).
 */
function phaseRecordOwner(
	rec: MigrationDecisionRecord,
	dirNameToSkillName: Map<string, string>,
): { type: PortableType; source: string } | null {
	if (rec.type === "skill") {
		const m = rec.source.match(/^\.claude\/skills\/([^/]+)\//);
		if (m) return { type: "skill", source: dirNameToSkillName.get(m[1]) ?? m[1] };
		return { type: "skill", source: rec.source };
	}
	if (rec.type === "hooks") return { type: "hooks", source: rec.source };
	return { type: rec.type, source: rec.source };
}
