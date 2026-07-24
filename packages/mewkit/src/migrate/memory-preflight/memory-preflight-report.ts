// Render a preflight plan as a human-readable summary (for `--dry-run`) and as a
// stable machine object (for tooling/tests). The exit code distinguishes a clean
// plan (0) from one with conflicts (non-zero) so callers can fail closed.
import pc from "picocolors";
import type { InventoryEntry, PreflightResult } from "./preflight-types.js";

const ACTION_LABEL: Record<InventoryEntry["action"], string> = {
	stage: "stage",
	noop: "up-to-date",
	conflict: "CONFLICT",
	quarantine: "quarantine",
	skip: "skip",
};

/** Non-zero when the plan has conflicts (never auto-resolved). */
export function preflightExitCode(result: PreflightResult): number {
	return result.conflicts.length > 0 ? 2 : 0;
}

/** Machine-readable projection (stable field order) for JSON output + tests. */
export function preflightToJson(result: PreflightResult): unknown {
	return {
		legacyRoot: result.legacyRoot,
		meowkitRoot: result.meowkitRoot,
		noop: result.noop,
		counts: {
			total: result.inventory.length,
			stage: result.inventory.filter((e) => e.action === "stage").length,
			quarantine: result.inventory.filter((e) => e.action === "quarantine").length,
			conflict: result.conflicts.length,
			skip: result.inventory.filter((e) => e.action === "skip").length,
			noop: result.inventory.filter((e) => e.action === "noop").length,
			secretFlagged: result.inventory.filter((e) => (e.secretFindings?.length ?? 0) > 0).length,
		},
		inventory: result.inventory.map((e) => ({
			relPath: e.relPath,
			targetClass: e.targetClass,
			targetRelPath: e.targetRelPath,
			size: e.size,
			checksum: e.checksum,
			validationState: e.validationState,
			action: e.action,
			...(e.note ? { note: e.note } : {}),
			...(e.secretFindings?.length ? { secretFindings: e.secretFindings } : {}),
		})),
	};
}

/** Human-readable summary for `mewkit migrate --dry-run`. */
export function renderPreflightReport(result: PreflightResult): string {
	if (result.noop && result.inventory.length === 0) {
		return "Memory preflight: no legacy .claude/memory/ content to migrate.";
	}
	if (result.noop) {
		return `Memory preflight: already migrated — ${result.inventory.length} file(s) up-to-date, nothing to do.`;
	}

	const lines: string[] = ["Memory preflight plan (.claude/memory/ → .meowkit/):", ""];
	for (const e of result.inventory) {
		const label = ACTION_LABEL[e.action];
		const arrow = e.targetRelPath ? ` → ${e.targetRelPath}` : "";
		const colored = e.action === "conflict" ? pc.red(label) : e.action === "quarantine" ? pc.yellow(label) : label;
		lines.push(`  [${colored}] ${e.relPath}${arrow}${e.note ? `  (${e.note})` : ""}`);
	}
	lines.push("");
	lines.push(
		`Summary: ${result.actions.length} to stage, ${result.conflicts.length} conflict(s), ${
			result.inventory.filter((e) => e.action === "skip").length
		} skipped.`,
	);
	if (result.conflicts.length > 0) {
		lines.push(pc.red("Conflicts must be resolved before migrating — nothing is overwritten or merged automatically."));
	}
	const flagged = result.inventory.filter((e) => (e.secretFindings?.length ?? 0) > 0);
	if (flagged.length > 0) {
		lines.push("");
		lines.push(
			pc.yellow(
				`⚠ ${flagged.length} file(s) contain secret-like content — quarantined to memory/legacy/ (not published, not deleted). Review and remove the secret, then re-run:`,
			),
		);
		for (const e of flagged) {
			const types = [...new Set((e.secretFindings ?? []).map((f) => f.type))].join(", ");
			lines.push(pc.yellow(`    ${e.relPath} (${types})`));
		}
	}
	return lines.join("\n");
}
