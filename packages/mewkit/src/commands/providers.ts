import pc from "picocolors";
import {
	collectProviderSupportMatrix,
	findProviderSupportInfo,
	type ProviderSupportInfo,
	type ProviderSupportMatrix,
} from "../migrate/provider-support-summary.js";

export interface ProvidersCliArgs {
	provider?: string;
	json?: boolean;
}

const ROLE_LABELS: Record<ProviderSupportInfo["role"], string> = {
	"full-harness": "full harness",
	"hard-gate-candidate": "hard-gate candidate",
	procedure: "procedure",
	"policy-advisory": "policy/advisory",
	"config-only": "config-only",
	disabled: "disabled",
	deprecated: "deprecated",
};

export async function providersCommand(args: ProvidersCliArgs = {}): Promise<void> {
	const matrix = collectProviderSupportMatrix();
	if (args.json === true) {
		const payload = args.provider ? findProviderSupportInfo(args.provider, matrix) : matrix;
		if (payload === null) {
			console.error(pc.red(`Unknown provider: ${args.provider}`));
			process.exit(2);
		}
		console.log(JSON.stringify(payload, null, 2));
		return;
	}

	if (args.provider) {
		const provider = findProviderSupportInfo(args.provider, matrix);
		if (provider === null) {
			console.error(pc.red(`Unknown provider: ${args.provider}`));
			printProviderNames(matrix);
			process.exit(2);
		}
		printProviderDetail(provider);
		return;
	}

	printProviderMatrix(matrix);
}

function printProviderMatrix(matrix: ProviderSupportMatrix): void {
	const { counts } = matrix;
	console.log(pc.bold(pc.cyan("MeowKit provider support")));
	console.log(
		pc.dim(
			`${counts.total} known providers — ${counts.verified} verified, ${counts.experimental} experimental, ${counts.deprecated} deprecated; ${counts.enabledSurfaces} enabled documented surfaces`,
		),
	);
	console.log();
	console.log(`  ${pc.bold(`${pad("PROVIDER", 16)} ${pad("LEVEL", 12)} ${pad("ROLE", 20)} SURFACES`)}`);
	for (const provider of matrix.providers) {
		console.log(
			`  ${pad(provider.id, 16)} ${pad(formatLevel(provider.supportLevel), 12)} ${pad(ROLE_LABELS[provider.role], 20)} ${formatSurfaceList(provider.effectiveSurfaces)}`,
		);
	}
	console.log();
	console.log(pc.dim("Run `mewkit providers <provider>` for paths, disabled surfaces, docs, and enforcement level."));
}

function printProviderDetail(provider: ProviderSupportInfo): void {
	console.log(pc.bold(pc.cyan(`${provider.displayName} (${provider.id})`)));
	console.log(`  ${pc.dim("Support level:")} ${formatLevel(provider.supportLevel)}`);
	if (provider.supportReason !== null && provider.supportReason.length > 0) {
		console.log(`  ${pc.dim("Reason:")} ${provider.supportReason}`);
	}
	console.log(`  ${pc.dim("Role:")} ${ROLE_LABELS[provider.role]}`);
	console.log(`  ${pc.dim("Subagents:")} ${provider.subagents}`);
	console.log(`  ${pc.dim("Enabled surfaces:")} ${formatSurfaceList(provider.effectiveSurfaces)}`);
	console.log(`  ${pc.dim("Disabled surfaces:")} ${formatSurfaceList(provider.disabledSurfaces)}`);
	console.log(
		`  ${pc.dim("Enforcement:")} Gate 1 ${provider.enforcement.gate1}, Gate 2 ${provider.enforcement.gate2}, secret protection ${provider.enforcement.secretProtection}`,
	);
	console.log();
	console.log(pc.bold("Surfaces"));
	for (const surface of provider.surfaces) {
		const status = surface.enabled ? pc.green("enabled") : pc.dim("disabled");
		const path = surface.enabled ? ` → ${surface.projectPath ?? "(global only)"}` : "";
		console.log(`  ${pad(surface.label, 10)} ${pad(surface.status, 12)} ${status}${path}`);
		if (surface.enabled) {
			console.log(`  ${" ".repeat(24)}${pc.dim(`${surface.format ?? "unknown"} / ${surface.writeStrategy ?? "unknown"}`)}`);
		}
		if (surface.note !== undefined && surface.note.length > 0) {
			console.log(`  ${" ".repeat(24)}${pc.dim(surface.note)}`);
		}
	}
	if (provider.docs.length > 0) {
		console.log();
		console.log(pc.bold("Docs"));
		for (const doc of provider.docs) console.log(`  ${doc}`);
	}
}

function printProviderNames(matrix: ProviderSupportMatrix): void {
	console.log(pc.dim(`Known providers: ${matrix.providers.map((provider) => provider.id).join(", ")}`));
}

function formatLevel(level: ProviderSupportInfo["supportLevel"]): string {
	if (level === "verified") return pc.green(level);
	if (level === "experimental") return pc.yellow(level);
	return pc.red(level);
}

function formatSurfaceList(surfaces: string[]): string {
	return surfaces.length > 0 ? surfaces.join(", ") : pc.dim("none");
}

function pad(value: string, width: number): string {
	return value.length >= width ? value : value + " ".repeat(width - value.length);
}
