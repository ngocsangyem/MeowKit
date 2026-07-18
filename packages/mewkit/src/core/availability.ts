// Typed host-availability adapters. Given a capability's logical requirements, produce an
// evidence-bearing snapshot of whether each requirement is actually satisfiable in THIS
// host — without executing anything the capability owns and without exposing secrets.
// Probes are injected so the adapters are pure and testable; the CLI supplies real probes.
// `host_tool`/`subagent_surface`/`lifecycle_event` report `unknown` here: the Claude Code
// runtime exposes no queryable tool/subagent contract to the CLI, and inferring one (e.g.
// from PATH) would be dishonest — a provider manifest declares them in a later phase.
import type { CapabilityEntry, TypedRequirement } from "./capability.js";

export type AvailabilityStatus = "available" | "unavailable" | "unknown" | "unsupported";

export interface AvailabilitySnapshot {
	requirementType: TypedRequirement["type"];
	id: string;
	status: AvailabilityStatus;
	/** Human-readable basis for the status — what was checked, not a guess. */
	evidence: string;
	/** ISO timestamp passed in by the caller (the pure core never reads the clock). */
	checkedAt: string;
	provider: string;
}

/** Injectable probes. Defaults live in the CLI; tests pass deterministic fakes. */
export interface AvailabilityProbes {
	/** Is an external binary resolvable on PATH? (reuses the CLI's cross-platform detector) */
	commandExists: (cmd: string) => boolean;
	/** Path-existence check for a requirement id. Returns `true`/`false` when the id resolves
	 * to a real contained path, and `null` when the id is not a checkable path (e.g. a bare
	 * logical skill-script id with no path mapping) — the caller resolves logical→path; this
	 * probe never interprets logical ids, and `null` surfaces honestly as `unknown`. */
	containedFileExists: (relPath: string) => boolean | null;
	/** Is an MCP server / app named `id` configured? null ⇒ cannot tell (no config on disk). */
	mcpServerConfigured: (id: string) => boolean | null;
}

export interface AvailabilityContext {
	provider: string;
	checkedAt: string;
	probes: AvailabilityProbes;
}

function snapshotFor(req: TypedRequirement, ctx: AvailabilityContext): AvailabilitySnapshot {
	const base = { requirementType: req.type, id: req.id, checkedAt: ctx.checkedAt, provider: ctx.provider };
	switch (req.type) {
		case "external_binary": {
			const ok = ctx.probes.commandExists(req.id);
			return {
				...base,
				status: ok ? "available" : "unavailable",
				evidence: `PATH lookup for "${req.id}": ${ok ? "found" : "not found"}`,
			};
		}
		case "skill_script":
		case "file_or_config": {
			const ok = ctx.probes.containedFileExists(req.id);
			if (ok === null)
				return {
					...base,
					status: "unknown",
					evidence: `"${req.id}" is a logical id with no path mapping — availability undetermined (not executed)`,
				};
			return {
				...base,
				status: ok ? "available" : "unavailable",
				evidence: `contained path "${req.id}": ${ok ? "present" : "absent"} (not executed)`,
			};
		}
		case "mcp_or_app": {
			const configured = ctx.probes.mcpServerConfigured(req.id);
			if (configured === null)
				return { ...base, status: "unknown", evidence: `no MCP config on disk to confirm "${req.id}"` };
			return {
				...base,
				status: configured ? "available" : "unavailable",
				evidence: `MCP config ${configured ? "declares" : "omits"} "${req.id}"`,
			};
		}
		case "host_tool":
			return {
				...base,
				status: "unknown",
				evidence: "host does not expose a queryable tool contract to the CLI (never inferred from PATH)",
			};
		case "subagent_surface":
			return {
				...base,
				status: "unknown",
				evidence: "subagent availability is a provider-contract fact, undeclared until a provider manifest asserts it",
			};
		case "lifecycle_event":
			return { ...base, status: "unknown", evidence: "lifecycle enforcement mapping is deferred to Phase 6" };
	}
}

/** Compute an availability snapshot per requirement of a capability. */
export function computeAvailability(entry: CapabilityEntry, ctx: AvailabilityContext): AvailabilitySnapshot[] {
	return entry.requirements.map((req) => snapshotFor(req, ctx));
}

/**
 * Roll a capability's requirement snapshots into one invocability verdict:
 * - `unavailable` if ANY requirement is unavailable (a hard blocker),
 * - `available` only if there are requirements and ALL are available,
 * - `unknown` otherwise (no requirements, or at least one unknown and none unavailable).
 * A capability with zero requirements is `unknown` — its host contract is unproven, not proven.
 */
export function rollUpInvocability(snapshots: AvailabilitySnapshot[]): AvailabilityStatus {
	if (snapshots.some((s) => s.status === "unavailable")) return "unavailable";
	if (snapshots.length > 0 && snapshots.every((s) => s.status === "available")) return "available";
	return "unknown";
}
