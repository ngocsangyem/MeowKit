import pc from "picocolors";
import { buildPortabilityMatrix, coverage, explainProvider } from "../core/portability-matrix.js";
import { ProviderType } from "../migrate/types.js";

export interface PortabilityArgs {
	subcommand?: string;
	provider?: string;
	json?: boolean;
}

function pad(s: string, n: number): string {
	return s.length >= n ? s : s + " ".repeat(n - s.length);
}

export function portability(args: PortabilityArgs = {}): void {
	const sub = args.subcommand ?? "matrix";
	if (sub === "matrix") {
		const rows = buildPortabilityMatrix();
		if (args.json) {
			console.log(JSON.stringify(rows, null, 2));
			return;
		}
		console.log(pc.bold(pc.cyan("Provider capability matrix")));
		console.log(`  ${pc.bold(pad("PROVIDER", 16))} ${pc.bold(pad("SURFACE", 8))} ${pc.bold(pad("STATUS", 12))} CONTRACT`);
		for (const r of rows) {
			console.log(`  ${pad(r.provider, 16)} ${pad(r.surface, 8)} ${pad(r.displayStatus, 12)} ${r.surfaceStatus}`);
		}
		return;
	}
	if (sub === "coverage") {
		const result = coverage();
		console.log(args.json ? JSON.stringify(result, null, 2) : `${result.documented}/${result.surfaces} documented surfaces, ${result.warn} warn, ${result.fail} fail`);
		return;
	}
	if (sub === "explain") {
		const parsed = ProviderType.safeParse(args.provider);
		if (!parsed.success) {
			console.error(pc.red(`Unknown provider: ${args.provider ?? "(missing)"}`));
			process.exit(1);
		}
		const rows = explainProvider(parsed.data);
		if (args.json) {
			console.log(JSON.stringify(rows, null, 2));
			return;
		}
		console.log(pc.bold(pc.cyan(`Provider capability: ${parsed.data}`)));
		for (const r of rows) {
			console.log(`  ${pc.bold(r.surface)}: ${r.displayStatus} (${r.message})`);
			if (r.docs.length > 0) console.log(`      ${pc.dim(r.docs.join(", "))}`);
		}
		return;
	}
	console.error(pc.red(`Unknown portability subcommand: ${sub}`));
	console.log(pc.dim("Usage: mewkit portability <matrix|coverage|explain> [provider] [--json]"));
	process.exit(1);
}
