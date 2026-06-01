import type { PortableType, ProviderType } from "./types.js";
import { ProviderType as ProviderTypeSchema } from "./types.js";
import type { ProviderConfig, ProviderSupportLevel } from "./providers/provider-config-types.js";
import type { ProviderSupportStatus } from "./providers/contract-types.js";
import { buildProviders, manifestRegistry, type ProviderManifest } from "./providers/index.js";

export type ProviderHarnessRole =
	| "full-harness"
	| "hard-gate-candidate"
	| "procedure"
	| "policy-advisory"
	| "config-only"
	| "disabled"
	| "deprecated";

export type EnforcementLevel = "hard" | "candidate" | "advisory" | "unsupported";

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
		const role = classifyProviderRole(supportLevel, effectiveSurfaces);
		infos.push({
			id,
			displayName: config.displayName,
			supportLevel,
			supportReason: config.supportReason ?? null,
			subagents: config.subagents,
			effectiveSurfaces,
			disabledSurfaces,
			role,
			enforcement: summarizeEnforcement(supportLevel, effectiveSurfaces),
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

export function findProviderSupportInfo(id: string, matrix = collectProviderSupportMatrix()): ProviderSupportInfo | null {
	return matrix.providers.find((provider) => provider.id === id) ?? null;
}

function classifyProviderRole(supportLevel: ProviderSupportLevel, effectiveSurfaces: string[]): ProviderHarnessRole {
	if (supportLevel === "deprecated") return "deprecated";
	if (effectiveSurfaces.length === 0) return "disabled";
	if (hasEverySurface(effectiveSurfaces)) return "full-harness";
	if (effectiveSurfaces.includes("hooks")) return "hard-gate-candidate";
	if (effectiveSurfaces.includes("commands") || effectiveSurfaces.includes("skills")) return "procedure";
	if (effectiveSurfaces.includes("rules") || effectiveSurfaces.includes("agents")) return "policy-advisory";
	return "config-only";
}

function summarizeEnforcement(
	supportLevel: ProviderSupportLevel,
	effectiveSurfaces: string[],
): ProviderEnforcementSummary {
	if (effectiveSurfaces.includes("hooks")) {
		const level: EnforcementLevel = supportLevel === "experimental" ? "candidate" : "hard";
		return { gate1: level, gate2: level, secretProtection: level };
	}
	if (effectiveSurfaces.includes("rules") || effectiveSurfaces.includes("config")) {
		return { gate1: "advisory", gate2: "advisory", secretProtection: "advisory" };
	}
	return { gate1: "unsupported", gate2: "unsupported", secretProtection: "unsupported" };
}

function hasEverySurface(effectiveSurfaces: string[]): boolean {
	return SURFACE_FIELDS.every((entry) => effectiveSurfaces.includes(entry.label));
}
