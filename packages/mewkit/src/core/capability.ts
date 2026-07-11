// Model-agnostic capability contract: one semantic entry per installed artifact (plus
// authored external tools / repo-context-state services), mapping an artifact to safe
// selection, logical invocation requirements, and verification. This is the resolution
// view; `InventoryEntry` (build-inventory.ts) stays the installation/governance view and
// the two reference each other by ID. Security invariant: frontmatter may name LOGICAL
// requirement/invocation IDs only — never a command string or a provider-native tool
// name. Trusted adapter code maps logical IDs to constant provider operations.
import { z } from "zod";

/** Capability kinds. Disk-enumerated: skill/agent/command/workflow/hook. Authored-only
 * (no disk artifact, no frontmatter): tool/context-service/state-service. `rule` artifacts
 * are inventory-only context and are deliberately NOT capabilities. */
export const CapabilityKindSchema = z.enum([
	"skill",
	"agent",
	"command",
	"workflow",
	"hook",
	"tool",
	"context-service",
	"state-service",
]);
export type CapabilityKind = z.infer<typeof CapabilityKindSchema>;

/** Where a field's value came from. `unknown` is surfaced, never invented. */
export const ProvenanceSchema = z.enum(["authored", "inferred", "adapter", "unknown"]);
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** Typed logical requirement. `id` is a logical identifier (e.g. an external_binary maps
 * to a system-dependency ID), never an executable command. */
export const TypedRequirementSchema = z.object({
	type: z.enum([
		"host_tool",
		"mcp_or_app",
		"external_binary",
		"subagent_surface",
		"skill_script",
		"lifecycle_event",
		"file_or_config",
	]),
	id: z.string(),
	provenance: ProvenanceSchema.default("inferred"),
});
export type TypedRequirement = z.infer<typeof TypedRequirementSchema>;

/** A logical invocation contract. `id` must be a known logical invocation ID; adapters
 * map it to a constant provider operation. `none` = not directly invocable (e.g. a hook). */
export const InvocationSchema = z.object({
	kind: z.enum(["skill", "agent", "command", "workflow", "hook", "none"]),
	id: z.string(),
});
export type Invocation = z.infer<typeof InvocationSchema>;

/** The four independent host-support levels, per provider. Populated from adapter
 * evidence only; absence ⇒ unknown. `invocable` at rest is static adapter capability —
 * the resolver reports runtime invocability as pending until Phase 3's host snapshot. */
export const SupportLevelsSchema = z.object({
	discoverable: z.boolean(),
	selectable: z.boolean(),
	invocable: z.boolean(),
	enforceable: z.boolean(),
});
export type SupportLevels = z.infer<typeof SupportLevelsSchema>;

/** How to verify the capability did its job. `unknown` is explicit, not a silent gap. */
export const VerificationSchema = z.object({
	kind: z.enum(["command", "file", "runtime", "none", "unknown"]),
	id: z.string().optional(),
});
export type Verification = z.infer<typeof VerificationSchema>;

export const CapabilityEntrySchema = z.object({
	id: z.string(),
	kind: CapabilityKindSchema,
	description: z.string().default(""),
	aliases: z.array(z.string()).default([]),
	/** `.claude/`-relative source path, or null for authored kinds with no disk artifact. */
	sourcePath: z.string().nullable().default(null),
	/** Cross-reference to the matching InventoryEntry.id, or null for authored-only kinds. */
	inventoryId: z.string().nullable().default(null),
	/** Denormalized from inventory for self-contained output; agreement is validated. */
	owner: z.string().default(""),
	installedState: z.enum(["installed", "absent", "unknown"]).default("unknown"),
	/** Bounded selection terms — authored for flagship flows, else inferred from keywords. */
	intents: z.array(z.string()).default([]),
	whenToUse: z.string().nullable().default(null),
	invocation: InvocationSchema,
	requirements: z.array(TypedRequirementSchema).default([]),
	/** Per-provider support levels; absent provider ⇒ unknown support for that provider. */
	support: z.record(z.string(), SupportLevelsSchema).default({}),
	verification: VerificationSchema.default({ kind: "unknown" }),
	dependencies: z
		.object({ upstream: z.array(z.string()).default([]), downstream: z.array(z.string()).default([]) })
		.default({ upstream: [], downstream: [] }),
	/** field name → where that field's value came from. */
	provenance: z.record(z.string(), ProvenanceSchema).default({}),
});
export type CapabilityEntry = z.infer<typeof CapabilityEntrySchema>;

export const CapabilityManifestSchema = z.object({
	schemaVersion: z.literal("1.0"),
	entries: z.array(CapabilityEntrySchema),
});
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;

/** Known logical invocation IDs. Frontmatter may reference only these; adapter code maps
 * each to a constant provider operation. A capability naming an ID outside this set is a
 * validation error — hostile frontmatter cannot smuggle an executable string through. */
export const KNOWN_INVOCATION_IDS: ReadonlySet<string> = new Set([
	"invoke-skill",
	"invoke-agent",
	"invoke-command",
	"invoke-workflow",
	"lifecycle-hook",
	"none",
]);
