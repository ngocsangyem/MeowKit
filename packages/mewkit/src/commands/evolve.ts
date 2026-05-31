import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { readEvents } from "../core/event-log.js";
import { suggestionsFromEvents } from "../core/evolution/event-clusters.js";
import { renderSuggestions } from "../core/evolution/recommendation-renderer.js";
import { filterSuggestions } from "../core/evolution/suggestions.js";

export interface EvolveArgs {
	subcommand?: string;
	json?: boolean;
	last?: string;
	task?: string;
	kind?: string;
	minConfidence?: number;
	out?: string;
}

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

function collectSuggestions(args: EvolveArgs) {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}
	const { events, malformed } = readEvents(claudeDir, { since: args.last, task: args.task });
	return filterSuggestions(suggestionsFromEvents(events, malformed), {
		minConfidence: args.minConfidence,
		kind: args.kind,
	});
}

export function evolve(args: EvolveArgs = {}): void {
	const subcommand = args.subcommand ?? "suggest";
	if (subcommand !== "suggest" && subcommand !== "report") {
		console.error(pc.red(`Unknown evolve subcommand: ${subcommand}`));
		console.log(pc.dim("Usage: mewkit evolve <suggest|report> [--json] [--last 30d] [--kind review-promotion]"));
		process.exit(1);
	}

	const suggestions = collectSuggestions(args);
	if (args.json) {
		const text = JSON.stringify(suggestions, null, 2);
		if (subcommand === "report" && args.out) fs.writeFileSync(args.out, `${text}\n`, "utf-8");
		else console.log(text);
		return;
	}

	if (subcommand === "report" && args.out) {
		const lines = [
			"# MeowKit Evolution Report",
			"",
			"No rules, skills, hooks, packs, or policies were changed.",
			"",
			...suggestions.flatMap((s, i) => [
				`## ${i + 1}. ${s.title}`,
				"",
				`- Kind: ${s.kind}`,
				`- Confidence: ${Math.round(s.confidence * 100)}%`,
				`- Impact: ${s.impact}`,
				`- Risk: ${s.risk}`,
				`- Proposed action: ${s.proposedAction}`,
				"",
			]),
		];
		fs.writeFileSync(args.out, `${lines.join("\n")}\n`, "utf-8");
		console.log(pc.green(`Wrote proposal-only report: ${args.out}`));
		return;
	}

	renderSuggestions(suggestions);
}
