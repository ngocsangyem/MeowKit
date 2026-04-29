// Vendored from claudekit-cli (MIT). Source: src/commands/portable/diff-display.ts
import { createTwoFilesPatch } from "diff";
import { sanitizeTerminalText } from "./output-sanitizer.js";

const DEFAULT_MAX_DIFF_PREVIEW_LINES = 200;

export function generateDiff(oldContent: string, newContent: string, fileName: string): string {
	return createTwoFilesPatch(
		`a/${fileName}`,
		`b/${fileName}`,
		oldContent,
		newContent,
		"registered version",
		"current version",
		{ context: 3 },
	);
}

const ESC = "\x1b";

function resolveMaxDiffPreviewLines(options: { maxLines?: number }): number {
	const { maxLines } = options;
	if (typeof maxLines === "number" && Number.isInteger(maxLines) && maxLines > 0) return maxLines;
	return DEFAULT_MAX_DIFF_PREVIEW_LINES;
}

export function displayDiff(diff: string, options: { color: boolean; maxLines?: number }): void {
	const maxLines = resolveMaxDiffPreviewLines(options);
	const lines = diff.split("\n");
	const preview = lines.slice(0, maxLines);

	for (const line of preview) {
		const sanitized = sanitizeTerminalText(line);

		if (options.color) {
			if (sanitized.startsWith("+")) console.log(`${ESC}[32m${sanitized}${ESC}[0m`);
			else if (sanitized.startsWith("-")) console.log(`${ESC}[31m${sanitized}${ESC}[0m`);
			else if (sanitized.startsWith("@@")) console.log(`${ESC}[36m${sanitized}${ESC}[0m`);
			else console.log(sanitized);
		} else {
			console.log(sanitized);
		}
	}

	if (lines.length > preview.length) {
		const hiddenCount = lines.length - preview.length;
		console.log(
			`  [i] Diff preview truncated (${hiddenCount} more line(s); showing first ${preview.length})`,
		);
	}
}
