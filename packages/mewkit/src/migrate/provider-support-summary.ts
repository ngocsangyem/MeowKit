import type { PortableType, ProviderType } from "./types.js";
import { ProviderType as ProviderTypeSchema } from "./types.js";
import type { ProviderConfig, ProviderSupportLevel } from "./providers/provider-config-types.js";
import type { ProviderSupportStatus } from "./providers/contract-types.js";
import { buildProviders, manifestRegistry, type ProviderManifest } from "./providers/index.js";
import { providerSummary, type SurfaceEnforcement, type ProviderSupportState } from "../core/provider-adapter.js";
import { isProjectedProvider } from "../core/provider-projection.js";

export type ProviderHarnessRole =
	"full-harness" | "hard-gate-candidate" | "procedure" | "policy-advisory" | "config-only" | "disabled" | "deprecated";

/** Re-export the unified enforcement vocabulary so legacy import sites keep resolving. The support
 * summary no longer owns an enforcement enum — it derives from the adapter (Phase 1 truth model). */
export type EnforcementLevel = SurfaceEnforcement;

interface SurfaceField {
	surface: PortableType;
	field: "agents" | "commands" | "skills" | "config" | "rules" | "hooks";
	label: string;
}

const SURFACE_FIELDS: readonly SurfaceField[] = [
	{ surface: "agent", field: "agents", label: "agents" },
	{ surface: "command", field: "commands", label: "commands" },
	{ surface: "skill", field: "skills", label: "skills" },
	{ surface: "config", field: "config", label: "config" },
	{ surface: "rules", field: "rules", label: "rules" },
	{ surface: "hooks", field: "hooks", label: "hooks" },
];

export interface ProviderSurfaceSupport {
	surface: PortableType;
	label: string;
	status: ProviderSupportStatus;
	enabled: boolean;
	projectPath: string | null;
	globalPath: string | null;
	format: string | null;
	writeStrategy: string | null;
	docs: string[];
	note?: string;
}

export interface ProviderEnforcementSummary {
	gate1: EnforcementLevel;
	gate2: EnforcementLevel;
	secretProtection: EnforcementLevel;
}

export interface ProviderSupportInfo {
	id: ProviderType;
	displayName: string;
	supportLevel: ProviderSupportLevel;
	supportReason: string | null;
	subagents: ProviderConfig["subagents"];
	effectiveSurfaces: string[];
	disabledSurfaces: string[];
	role: ProviderHarnessRole;
	enforcement: ProviderEnforcementSummary;
	/** Capability headline from the adapter truth model — present ONLY for providers with an
	 * authored adapter projection (claude-code, codex, …); `null` for migration-only providers that
	 * the adapter treats as report-only. Both CLI views render this so they cannot disagree. */
	capabilityStatus: ProviderSupportState | null;
	docs: string[];
	surfaces: ProviderSurfaceSupport[];
}

export interface ProviderSupportMatrix {
	providers: ProviderSupportInfo[];
	counts: {
		total: number;
		verified: number;
		experimental: number;
		deprecated: number;
		enabledSurfaces: number;
	};
}

export function collectProviderSupportMatrix(manifests: ProviderManifest[] = manifestRegistry): ProviderSupportMatrix {
	const effectiveProviders = buildProviders(manifests);
	const infos: ProviderSupportInfo[] = [];

	for (const manifest of manifests) {
		const parsed = ProviderTypeSchema.safeParse(manifest.id);
		if (!parsed.success) continue;
		const id = parsed.data;
		const config = effectiveProviders[id];
		if (config === undefined) continue;

		const supportLevel = config.supportLevel ?? "verified";
		const surfaces = SURFACE_FIELDS.map((entry) => {
			const contract = manifest.contract.surfaces[entry.surface];
			const pathConfig = config[entry.field];
			return {
				surface: entry.surface,
				label: entry.label,
				status: contract?.status ?? "unsupported",
				enabled: pathConfig !== null,
				projectPath: pathConfig?.projectPath ?? null,
				globalPath: pathConfig?.globalPath ?? null,
				format: pathConfig?.format ?? null,
				writeStrategy: pathConfig?.writeStrategy ?? null,
				docs: contract?.docs ?? [],
				note: contract?.note,
			};
		});
		const effectiveSurfaces = surfaces.filter((surface) => surface.enabled).map((surface) => surface.label);
		const disabledSurfaces = surfaces.filter((surface) => !surface.enabled).map((surface) => surface.label);
		const enforcement = summarizeEnforcement(id, effectiveSurfaces);
		const capabilityStatus = isProjectedProvider(id) ? providerSummary(id).supportState : null;
		const role = classifyProviderRole(supportLevel, effectiveSurfaces, enforcement.gate1 === "enforced");
		infos.push({
			id,
			displayName: config.displayName,
			supportLevel,
			supportReason: config.supportReason ?? null,
			subagents: config.subagents,
			effectiveSurfaces,
			disabledSurfaces,
			role,
			enforcement,
			capabilityStatus,
			docs: manifest.contract.docs,
			surfaces,
		});
	}

	return {
		providers: infos,
		counts: {
			total: infos.length,
			verified: infos.filter((provider) => provider.supportLevel === "verified").length,
			experimental: infos.filter((provider) => provider.supportLevel === "experimental").length,
			deprecated: infos.filter((provider) => provider.supportLevel === "deprecated").length,
			enabledSurfaces: infos.reduce((sum, provider) => sum + provider.effectiveSurfaces.length, 0),
		},
	};
}

export function findProviderSupportInfo(
	id: string,
	matrix = collectProviderSupportMatrix(),
): ProviderSupportInfo | null {
	return matrix.providers.find((provider) => provider.id === id) ?? null;
}

/**
 * A provider is `full-harness` ONLY when it exposes every surface AND the adapter proves it can
 * actually enforce (`enforces`). Having a hooks surface configured is NOT enough — that is exactly
 * the codex over-claim MK-P0-01 fixed: codex migrates every surface but cannot prove a gate, so it
 * is a hard-gate CANDIDATE, not a full harness.
 */
function classifyProviderRole(
	supportLevel: ProviderSupportLevel,
	effectiveSurfaces: string[],
	enforces: boolean,
): ProviderHarnessRole {
	if (supportLevel === "deprecated") return "deprecated";
	if (effectiveSurfaces.length === 0) return "disabled";
	if (hasEverySurface(effectiveSurfaces) && enforces) return "full-harness";
	if (effectiveSurfaces.includes("hooks")) return "hard-gate-candidate";
	if (effectiveSurfaces.includes("commands") || effectiveSurfaces.includes("skills")) return "procedure";
	if (effectiveSurfaces.includes("rules") || effectiveSurfaces.includes("agents")) return "policy-advisory";
	return "config-only";
}

/**
 * Enforcement is sourced from ONE truth model. For a provider with an authored adapter projection
 * (claude-code, codex) the adapter's proven-gate derivation is authoritative — no surface heuristic
 * may re-decide it. For migration-only providers (no adapter) the surface shape is the honest signal:
 * a rules/config surface advises (prompt-level), everything else is unsupported. The only providers
 * with a hooks surface are adapter-projected, so a hooks surface never reaches the heuristic branch
 * to claim enforcement it cannot prove.
 */
function summarizeEnforcement(id: ProviderType, effectiveSurfaces: string[]): ProviderEnforcementSummary {
	if (isProjectedProvider(id)) {
		return providerSummary(id).enforcement;
	}
	if (effectiveSurfaces.includes("rules") || effectiveSurfaces.includes("config")) {
		return { gate1: "advisory", gate2: "advisory", secretProtection: "advisory" };
	}
	return { gate1: "unsupported", gate2: "unsupported", secretProtection: "unsupported" };
}

function hasEverySurface(effectiveSurfaces: string[]): boolean {
	return SURFACE_FIELDS.every((entry) => effectiveSurfaces.includes(entry.label));
}
