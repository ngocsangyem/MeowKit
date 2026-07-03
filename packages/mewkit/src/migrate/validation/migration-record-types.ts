// Shared decision-record data contract for the migration pipeline.
//
// Every phase that decides the fate of a source artifact (migrated / skipped /
// failed / neutralized) emits records that conform to these types; the final
// run-report layer serializes them into a single "what migrated and why" view.
// The reference-occurrence stream (below) is the first producer: the fenced-
// reference integrity pass records one occurrence per classified source ref.
//
// These are pure type declarations — no runtime logic. Keep them minimal:
// producers add the fields they can populate, consumers read what is present.

import type { ReferenceOccurrence } from "../references/reference-types.js";
import type { PortableType, ProviderType } from "../types.js";

/** The outcome the pipeline reached for a single source artifact. */
export type MigrationOutcome =
	| "migrated" // written to the target in a provider-native form
	| "skipped" // deliberately not migrated (no provider surface, policy exclusion)
	| "failed" // attempted but rejected (audit failure, conversion error)
	| "partial"; // migrated with loss (dropped sections, unsupported features)

/** Why the pipeline reached a given outcome, coarse enough to group records. */
export type MigrationReasonCode =
	| "converted" // clean conversion to a provider target
	| "no-provider-surface" // the source concept has no equivalent on the target provider
	| "policy-excluded" // a portability policy excluded this artifact for the provider
	| "audit-rejected" // a fail-closed audit blocked the artifact
	| "conversion-error" // the converter threw or produced no usable output
	| "reference-preserved" // a source reference was left unchanged (out of migration set)
	| "runtime-neutralized" // a runtime-coupling match was rewritten/neutralized + annotated (warn, not fail)
	| "event-unsupported" // a hook event has no equivalent on the target provider — dropped
	| "matcher-narrowed"; // a hook migrated but with a reduced matcher set (target support limit)

/** One decision about one source artifact, emitted by any migration phase. */
export interface MigrationDecisionRecord {
	/** Source-relative identifier of the artifact (e.g. ".claude/agents/planner.md"). */
	source: string;
	/** Portable classification of the artifact. */
	type: PortableType;
	/** Provider the decision applies to. */
	provider: ProviderType;
	/** The outcome the pipeline reached. */
	outcome: MigrationOutcome;
	/** Coarse reason grouping for the outcome. */
	reason: MigrationReasonCode;
	/** Human-readable detail for the run report (optional). */
	detail?: string;
	/** Target-relative path written, when outcome === "migrated" | "partial". */
	target?: string;
	/**
	 * Reference occurrences observed while processing this artifact. The fenced-
	 * reference integrity pass is the first producer of these records.
	 */
	occurrences?: ReferenceOccurrence[];
}

/** The serialized decision-record set for one migration run. */
export interface MigrationRecordSet {
	/** Provider this run targeted. */
	provider: ProviderType;
	/** ISO-8601 timestamp the run completed. */
	completedAt: string;
	/** Every per-artifact decision the run made. */
	decisions: MigrationDecisionRecord[];
}
