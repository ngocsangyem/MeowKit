// Build the model-agnostic capability manifest from an installed `.claude/`. Reuses the
// canonical artifact enumeration + frontmatter/registry readers from build-inventory.ts;
// it does NOT re-implement "what counts". Disk-enumerated skills/agents/commands/hooks
// become capabilities (rules are inventory-only context and are excluded). Owner and
// installed-state are denormalized from the inventory (provenance `inferred`) so resolver
// output is self-contained; a validation pass asserts agreement. Authored external-tool
// and repo/context/state-service capabilities have no disk artifact (provenance `authored`).
import { buildInventory, enumerateArtifacts, readFrontmatter, type ArtifactType } from "./build-inventory.js";
import type { CapabilityEntry, CapabilityKind, Invocation, Provenance } from "./capability.js";
import { AUTHORED_CAPABILITIES, AUTHORED_CONTEXT_REQUIREMENTS, AUTHORED_INTENTS } from "./capability-authored.js";

/** Disk artifact types that project to a capability, mapped to their capability kind.
 * `rule` is intentionally absent — rules are always-on context, not invocable capabilities. */
const KIND_BY_ARTIFACT: Partial<Record<ArtifactType, CapabilityKind>> = {
	skill: "skill",
	agent: "agent",
	command: "command",
	hook: "hook",
};

/** Logical invocation contract per capability kind. IDs are logical — adapters map them
 * to constant provider operations; no command string ever comes from frontmatter. */
function invocationFor(kind: CapabilityKind): Invocation {
	switch (kind) {
		case "skill":
			return { kind: "skill", id: "invoke-skill" };
		case "agent":
			return { kind: "agent", id: "invoke-agent" };
		case "command":
			return { kind: "command", id: "invoke-command" };
		case "workflow":
			return { kind: "workflow", id: "invoke-workflow" };
		case "hook":
			return { kind: "hook", id: "lifecycle-hook" };
		default:
			return { kind: "none", id: "none" };
	}
}

/** Bounded intent terms inferred from a skill's `keywords` frontmatter (deduped, lowercased). */
function inferredIntents(meta: Record<string, unknown>): string[] {
	if (!Array.isArray(meta.keywords)) return [];
	return [...new Set(meta.keywords.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase()))];
}

/**
 * Build the capability manifest for an installed `.claude/`. Every disk-enumerated
 * invocable-kind artifact yields exactly one capability keyed by its `.claude/`-relative
 * path (the stable inventory cross-reference); authored tool/service capabilities are
 * appended. Field provenance records where each value came from.
 */
export function buildCapabilities(claudeDir: string): CapabilityEntry[] {
	const { refs } = enumerateArtifacts(claudeDir);
	const inventory = buildInventory(claudeDir);
	const invByPath = new Map(inventory.entries.map((e) => [e.path, e]));

	const entries: CapabilityEntry[] = [];

	for (const ref of refs) {
		const kind = KIND_BY_ARTIFACT[ref.type];
		if (!kind) continue; // rules and anything unmapped are not capabilities

		const meta = ref.metaSource === "frontmatter" ? readFrontmatter(ref.abs) : {};
		const inv = invByPath.get(ref.rel);
		const description = typeof meta.description === "string" ? meta.description : "";
		const whenToUse = typeof meta.when_to_use === "string" ? meta.when_to_use : null;

		const provenance: Record<string, Provenance> = {
			kind: "inferred",
			owner: "inferred",
			installedState: "inferred",
			invocation: "inferred",
		};
		if (description) provenance.description = "inferred";
		if (whenToUse !== null) provenance.whenToUse = "inferred";
		if (inv?.dependsOn && inv.dependsOn.length > 0) provenance.dependencies = "inferred";

		// Flagship overlay wins over inferred keywords: curated, bounded, authored intents.
		const overlay = AUTHORED_INTENTS[ref.id];
		let intents: string[];
		let aliases: string[];
		if (overlay) {
			intents = overlay.intents;
			aliases = overlay.aliases ?? [];
			provenance.intents = "authored";
			if (aliases.length > 0) provenance.aliases = "authored";
		} else {
			intents = inferredIntents(meta);
			aliases = [];
			if (intents.length > 0) provenance.intents = "inferred";
		}

		// Repo-context requirement overlay (Phase 5): source-grounded flagship flows declare that
		// they must acquire a task-scoped envelope before source-grounded work.
		const ctxReq = AUTHORED_CONTEXT_REQUIREMENTS[ref.id];
		const contextRequirement = ctxReq ? { scope: "task-repo" as const, reason: ctxReq.reason } : null;
		if (contextRequirement) provenance.contextRequirement = "authored";

		entries.push({
			id: ref.id,
			kind,
			description,
			aliases,
			sourcePath: ref.rel,
			inventoryId: inv?.id ?? ref.id,
			owner: inv?.owner ?? "",
			// Derived from enumeration-presence, not a distinct inventory field (InventoryEntry
			// carries `status`, not installed-state): a disk-enumerated artifact is installed.
			installedState: "installed",
			intents,
			whenToUse,
			invocation: invocationFor(kind),
			requirements: [],
			contextRequirement,
			support: {},
			verification: { kind: "unknown" },
			dependencies: { upstream: inv?.dependsOn ?? [], downstream: [] },
			provenance,
		});
	}

	// Authored external-tool / repo-context-state-service capabilities (no disk artifact).
	entries.push(...AUTHORED_CAPABILITIES);

	entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return entries;
}
