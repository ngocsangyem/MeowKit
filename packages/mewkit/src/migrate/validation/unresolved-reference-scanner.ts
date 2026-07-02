// Post-conversion invariant check: every source reference surviving in
// generated output must be explained by a classifier decision (preserve,
// preserve-warn, or a rewrite whose target legitimately still matches the
// source pattern). An unexplained survivor means the rewriter missed a case —
// that is an internal error, not a user-content warning.

import { sourceReferencePattern } from "../references/reference-target-registry.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";

export interface ScannedOutput {
	/** Display name for the output (e.g. "codex/config/CLAUDE" or a file path) */
	file: string;
	content: string;
	occurrences: ReferenceOccurrence[];
}

export interface ValidationFinding {
	severity: "error" | "warning";
	file: string;
	line: number;
	reference: string;
	message: string;
}

function lineNumberAt(content: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < content.length; i++) {
		if (content[i] === "\n") line++;
	}
	return line;
}

/** True when a surviving source reference is covered by a classifier decision. */
export function isExplainedReference(reference: string, occurrences: ReferenceOccurrence[]): boolean {
	return occurrences.some((occurrence) => {
		if (occurrence.decision === "preserve" || occurrence.decision === "preserve-warn") {
			return occurrence.original.toLowerCase() === reference.toLowerCase();
		}
		// A rewrite target can itself match the source pattern (e.g. a provider
		// that reads skills from the source tree) — that survivor is legitimate.
		return occurrence.rewrittenTo?.toLowerCase().includes(reference.toLowerCase()) ?? false;
	});
}

export function scanUnresolvedReferences(outputs: ScannedOutput[]): ValidationFinding[] {
	const findings: ValidationFinding[] = [];

	for (const output of outputs) {
		const pattern = sourceReferencePattern();
		for (const match of output.content.matchAll(pattern)) {
			if (match.index === undefined) continue;
			const reference = match[0];
			if (isExplainedReference(reference, output.occurrences)) continue;
			findings.push({
				severity: "error",
				file: output.file,
				line: lineNumberAt(output.content, match.index),
				reference,
				message: `unexplained source reference "${reference}" survived conversion — the reference rewriter missed this case`,
			});
		}
	}

	return findings;
}
