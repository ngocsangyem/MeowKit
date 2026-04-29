// Vendored from claudekit-cli (MIT). Source: src/commands/portable/conflict-resolver.ts
import * as p from "@clack/prompts";
import { displayDiff } from "./diff-display.js";
import { sanitizeSingleLineTerminalText } from "./output-sanitizer.js";
import type { ConflictResolution, ReconcileAction } from "./reconcile-types.js";

const MAX_SHOW_DIFF_ATTEMPTS = 5;
export type NonInteractiveConflictPolicy = "keep" | "overwrite" | "skip";

function resolveNonInteractiveConflict(
	policy: NonInteractiveConflictPolicy | string | undefined,
): ConflictResolution {
	if (policy === "overwrite") return { type: "overwrite" };
	return { type: "keep" };
}

export async function resolveConflict(
	action: ReconcileAction,
	options: {
		interactive: boolean;
		color: boolean;
		nonInteractivePolicy?: NonInteractiveConflictPolicy | string;
	},
): Promise<ConflictResolution> {
	if (!options.interactive) return resolveNonInteractiveConflict(options.nonInteractivePolicy);

	const conflictKey = sanitizeSingleLineTerminalText(
		`${action.provider}/${action.type}/${action.item}`,
	);
	console.log("\n+---------------------------------------------+");
	console.log(`| [!] Conflict: ${conflictKey}`);
	console.log("+---------------------------------------------+");
	console.log("  mewkit updated source since last install");
	console.log("  Target file was also modified (user edits detected)");
	console.log();

	const choices: Array<{ value: string; label: string }> = [
		{ value: "overwrite", label: "Overwrite with mewkit version (lose your edits)" },
		{ value: "keep", label: "Keep your version (skip mewkit update)" },
	];

	if (action.ownedSections && action.ownedSections.length > 0) {
		choices.push({
			value: "smart-merge",
			label: "Smart merge (update mewkit sections, preserve your additions)",
		});
	}

	choices.push({ value: "show-diff", label: "Show diff" });

	let showDiffAttempts = 0;
	while (true) {
		const choice = await p.select({ message: "How to resolve?", options: choices });

		if (p.isCancel(choice)) return { type: "keep" };

		if (choice === "show-diff") {
			showDiffAttempts += 1;
			if (action.diff) displayDiff(action.diff, options);
			else console.log("  [i] Diff not available (target content not loaded)");

			if (showDiffAttempts >= MAX_SHOW_DIFF_ATTEMPTS) {
				console.log("  [!] Diff view limit reached, keeping your version for safety.");
				return { type: "keep" };
			}

			console.log();
			continue;
		}

		if (choice === "overwrite") return { type: "overwrite" };
		if (choice === "keep") return { type: "keep" };
		if (choice === "smart-merge") return { type: "smart-merge" };

		return { type: "keep" };
	}
}
