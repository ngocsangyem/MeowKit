// How the capability-resolution surface projects into each host provider, and the four
// INDEPENDENT support levels per provider. This is a trusted constant declaration backed
// by adapter evidence — it must never over-claim. In particular `enforceable` is true only
// where the host actually guarantees the behavior (a real gating hook), NOT where only
// prompt compliance exists (an instruction the model may or may not follow). Providers
// without a tested projection are `report-only` with every level `unknown`.

/** Where/how the always-visible bootstrap reaches a provider's instruction surface. */
export type BootstrapPlacement =
	| "sessionstart-hook" // Claude Code flat-copy: a SessionStart hook cats the bootstrap file
	| "sessionstart-hook-via-plugin-build" // Claude plugin: same hook, propagated by `build-plugin`
	| "instruction-file" // Codex: a section in the AGENTS instruction surface (no gating hook)
	| "none"; // no tested projection

export type LevelSupport = "supported" | "advisory" | "unsupported" | "unknown";

export interface SupportLevelsDetail {
	/** Agent can learn capability resolution exists (bootstrap placed on an always-on surface). */
	discoverable: LevelSupport;
	/** The resolver can rank + pick a capability for an intent (the CLI is reachable). */
	selectable: LevelSupport;
	/** The host can actually invoke a resolved capability now. */
	invocable: LevelSupport;
	/** The host GUARANTEES the behavior (a real hook gate) — never true for prompt-only compliance. */
	enforceable: LevelSupport;
}

export interface ProviderProjection {
	provider: string;
	status: "supported" | "partial" | "report-only";
	bootstrapPlacement: BootstrapPlacement;
	levels: SupportLevelsDetail;
	/** Plain-language basis for the claims — what makes each level what it is. */
	evidence: string;
}

/** Providers whose bootstrap projection is authored + evidenced. Others are report-only. */
export const PROVIDER_PROJECTIONS: Record<string, ProviderProjection> = {
	"claude-code": {
		provider: "claude-code",
		status: "supported",
		bootstrapPlacement: "sessionstart-hook",
		levels: { discoverable: "supported", selectable: "supported", invocable: "supported", enforceable: "supported" },
		evidence: "Bootstrap on a SessionStart hook; host invokes skills/agents; real hooks gate behavior (enforceable).",
	},
	"claude-plugin": {
		provider: "claude-plugin",
		status: "supported",
		bootstrapPlacement: "sessionstart-hook-via-plugin-build",
		levels: { discoverable: "supported", selectable: "supported", invocable: "supported", enforceable: "supported" },
		evidence:
			"Same SessionStart hook, propagated into the plugin payload by `build-plugin`; plugin hooks gate behavior.",
	},
	codex: {
		provider: "codex",
		status: "partial",
		bootstrapPlacement: "instruction-file",
		// Codex surfaces the bootstrap via its AGENTS instruction file and can run projected
		// skills/commands, but its hook enforcement is version-gated and limited — so behavior
		// is prompt-advisory, NOT host-guaranteed. `enforceable` is honestly unsupported.
		levels: { discoverable: "supported", selectable: "supported", invocable: "advisory", enforceable: "unsupported" },
		evidence:
			"Migration writes a bounded AGENTS bootstrap plus validated .codex/capabilities.json; skill/command projection is advisory and hook enforcement version-gated ⇒ not enforceable.",
	},
};

/** Bootstrap providers that have an authored placement (supported or partial). */
export type ProjectedProvider = "claude-code" | "claude-plugin" | "codex";

export function getProjection(provider: string): ProviderProjection {
	return (
		PROVIDER_PROJECTIONS[provider] ?? {
			provider,
			status: "report-only",
			bootstrapPlacement: "none",
			levels: { discoverable: "unknown", selectable: "unknown", invocable: "unknown", enforceable: "unknown" },
			evidence: "No tested projection for this provider — report-only; no capability behavior is claimed.",
		}
	);
}

/** True when the provider has an authored bootstrap placement (not report-only). */
export function isProjectedProvider(provider: string): provider is ProjectedProvider {
	return provider in PROVIDER_PROJECTIONS;
}
