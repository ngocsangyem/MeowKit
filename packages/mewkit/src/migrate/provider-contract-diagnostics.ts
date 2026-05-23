import { buildProviders, buildProvidersRaw, manifestRegistry } from "./providers/index.js";
import type { ProviderManifest } from "./providers/index.js";
import type { ProviderSupportStatus } from "./providers/contract-types.js";
import type { ProviderConfig, ProviderSupportLevel } from "./providers/provider-config-types.js";
import { ProviderType as ProviderTypeSchema } from "./types.js";
import type { PortableType, ProviderType } from "./types.js";

export type ProviderDiagnosticSeverity = "pass" | "warn" | "fail";

export interface ProviderContractDiagnostic {
	provider: ProviderType;
	providerDisplayName: string;
	providerSupportLevel: ProviderSupportLevel;
	surface: PortableType;
	surfaceStatus: ProviderSupportStatus;
	severity: ProviderDiagnosticSeverity;
	message: string;
	docs: string[];
}

const PORTABLE_SURFACES: readonly PortableType[] = ["agent", "command", "skill", "config", "rules", "hooks"];

const SURFACE_FIELDS = {
	agent: "agents",
	command: "commands",
	skill: "skills",
	config: "config",
	rules: "rules",
	hooks: "hooks",
} as const satisfies Record<PortableType, keyof ProviderConfig>;

export function collectProviderContractDiagnostics(
	manifests: ProviderManifest[] = manifestRegistry,
): ProviderContractDiagnostic[] {
	const rawProviders = buildProvidersRaw(manifests);
	const effectiveProviders = buildProviders(manifests);
	const diagnostics: ProviderContractDiagnostic[] = [];

	for (const manifest of manifests) {
		const parsed = ProviderTypeSchema.safeParse(manifest.id);
		if (!parsed.success) continue;
		const provider = parsed.data;
		const rawConfig = rawProviders[provider];
		const effectiveConfig = effectiveProviders[provider];
		const providerSupportLevel = rawConfig.supportLevel ?? "verified";

		for (const surface of PORTABLE_SURFACES) {
			const field = SURFACE_FIELDS[surface];
			const contract = manifest.contract.surfaces[surface] ?? { status: "unsupported", docs: [] };
			const rawConfigured = Boolean(rawConfig[field]);
			const effectiveConfigured = Boolean(effectiveConfig[field]);
			const severity = classifySurface(contract.status, rawConfigured, effectiveConfigured);
			const message = buildDiagnosticMessage({
				displayName: rawConfig.displayName,
				surface,
				surfaceStatus: contract.status,
				rawConfigured,
				effectiveConfigured,
			});

			diagnostics.push({
				provider,
				providerDisplayName: rawConfig.displayName,
				providerSupportLevel,
				surface,
				surfaceStatus: contract.status,
				severity,
				message,
				docs: contract.docs,
			});
		}
	}

	return diagnostics;
}

export function summarizeProviderContractDiagnostics(
	diagnostics: ProviderContractDiagnostic[],
	targets?: ProviderType[],
): string[] {
	const targetSet = targets ? new Set(targets) : null;
	return diagnostics
		.filter((diagnostic) => !targetSet || targetSet.has(diagnostic.provider))
		.filter((diagnostic) => diagnostic.severity !== "pass")
		.map((diagnostic) => diagnostic.message);
}

function classifySurface(
	surfaceStatus: ProviderSupportStatus,
	rawConfigured: boolean,
	effectiveConfigured: boolean,
): ProviderDiagnosticSeverity {
	if (surfaceStatus === "documented") return effectiveConfigured ? "pass" : "warn";
	if (effectiveConfigured) return "fail";
	if (rawConfigured) return "warn";
	return "pass";
}

function buildDiagnosticMessage(args: {
	displayName: string;
	surface: PortableType;
	surfaceStatus: ProviderSupportStatus;
	rawConfigured: boolean;
	effectiveConfigured: boolean;
}): string {
	const surfaceLabels: Record<PortableType, string> = {
		agent: "agents",
		command: "commands",
		skill: "skills",
		config: "configs",
		rules: "rules",
		hooks: "hooks",
	};
	const surfaceLabel = surfaceLabels[args.surface];
	if (args.surfaceStatus === "documented" && !args.effectiveConfigured) {
		return `${args.displayName}: ${surfaceLabel} surface is documented but not configured`;
	}
	if (args.surfaceStatus !== "documented" && args.effectiveConfigured) {
		return `${args.displayName}: ${surfaceLabel} surface is ${args.surfaceStatus} but remains enabled`;
	}
	if (args.surfaceStatus !== "documented" && args.rawConfigured) {
		return `${args.displayName}: ${surfaceLabel} surface is ${args.surfaceStatus}; disabled by provider contract`;
	}
	return `${args.displayName}: ${surfaceLabel} surface matches provider contract`;
}
