import pc from "picocolors";
import { evaluateVerdictGate } from "../memory/verdict-schema.js";

// `mewkit verdict-gate <slug | path>` — Gate 2 proof-bundle check. Reads the
// machine-readable verdict JSON and exits:
//   0  → PASS / PASS_WITH_RISK (or tolerated legacy markdown-only verdict)
//   1  → BLOCKED / invalid / missing
//   2  → usage error
export function verdictGate(args: { slug?: string }): void {
	const target = args.slug;
	if (!target) {
		console.error(pc.red("Usage: mewkit verdict-gate <slug | path-to-verdict.json>"));
		process.exit(2);
	}

	const result = evaluateVerdictGate(target);

	if (result.ok) {
		if (result.status === "legacy-md") {
			console.log(pc.yellow(`⚠ verdict-gate: ${result.errors[0]}`));
		} else {
			console.log(pc.green(`✓ verdict-gate: ${result.decision} — ship may proceed.`));
		}
		return;
	}

	console.error(pc.red(`✗ verdict-gate blocked (${result.status}):`));
	for (const err of result.errors) console.error(`  ${err}`);
	process.exit(1);
}
