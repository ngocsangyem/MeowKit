import { collectProviderContractDiagnostics, type ProviderContractDiagnostic } from "../migrate/provider-contract-diagnostics.js";
import type { ProviderType } from "../migrate/types.js";

export interface PortabilityMatrixRow extends ProviderContractDiagnostic {
	displayStatus: "native" | "documented" | "disabled" | "unsupported" | "warn" | "fail";
}

export interface PortabilityCoverage {
	providers: number;
	surfaces: number;
	documented: number;
	disabledUnsupported: number;
	warn: number;
	fail: number;
}

function displayStatus(d: ProviderContractDiagnostic): PortabilityMatrixRow["displayStatus"] {
	if (d.provider === "claude-code" && d.surfaceStatus === "documented" && d.severity === "pass") return "native";
	if (d.severity === "fail") return "fail";
	if (d.severity === "warn") return "warn";
	if (d.surfaceStatus === "documented") return "documented";
	if (d.surfaceStatus === "unsupported") return "unsupported";
	return "disabled";
}

export function buildPortabilityMatrix(): PortabilityMatrixRow[] {
	return collectProviderContractDiagnostics().map((d) => ({ ...d, displayStatus: displayStatus(d) }));
}

export function explainProvider(provider: ProviderType): PortabilityMatrixRow[] {
	return buildPortabilityMatrix().filter((r) => r.provider === provider);
}

export function coverage(rows = buildPortabilityMatrix()): PortabilityCoverage {
	return {
		providers: new Set(rows.map((r) => r.provider)).size,
		surfaces: rows.length,
		documented: rows.filter((r) => r.surfaceStatus === "documented").length,
		disabledUnsupported: rows.filter((r) => r.surfaceStatus !== "documented" && r.severity !== "fail").length,
		warn: rows.filter((r) => r.severity === "warn").length,
		fail: rows.filter((r) => r.severity === "fail").length,
	};
}
