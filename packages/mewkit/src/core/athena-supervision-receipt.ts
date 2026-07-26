// Athena supervision receipt — the parent's per-checkpoint record.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md` §8.
//
// The receipt answers a question the dossier deliberately cannot: what was asked,
// what came back, and what the parent DID about it. Two fields carry that and are
// kept separate on purpose:
//
//   `disposition` — Athena's returned routing signal, recorded verbatim.
//   `outcome`     — what the parent did with it (adopted | rejected | deferred).
//
// Collapsing them would erase the case that matters most: a parent rightly
// rejecting a directive. A receipt that cannot express disagreement is a record of
// compliance, not of supervision.
//
// Pure of clock and filesystem. The date component arrives as an argument so the
// module stays deterministic and testable, matching the rest of the supervision core.
import { z } from "zod";
import { scanAuthorityLanguage, scanSecrets } from "./athena-supervision-packet.js";
import { DISPOSITIONS, SUPERVISION_STAGES } from "./athena-supervision-protocol.js";

/** What the parent did with the directive — never what the directive authorized. */
export const RECEIPT_OUTCOMES = ["adopted", "rejected", "deferred"] as const;
export type ReceiptOutcome = (typeof RECEIPT_OUTCOMES)[number];

export const ReceiptSchema = z
	.object({
		runId: z.string().min(1),
		stage: z.enum(SUPERVISION_STAGES),
		disposition: z.enum(DISPOSITIONS),
		outcome: z.enum(RECEIPT_OUTCOMES),
		/**
		 * Required even when the directive was adopted. "Why" is the one thing a later
		 * session cannot reconstruct from the artifacts, and an optional field that is
		 * only filled on disagreement quietly becomes a disagreement marker.
		 */
		reason: z.string().min(1),
		taskId: z.string().default("none"),
		provider: z.string().default("unknown"),
		skill: z.string().min(1),
		checkpointId: z.string().min(1),
		/**
		 * Which release stage's budget this call was charged to, for a skill whose cap
		 * is per-partition. Without it a reader of three ship receipts cannot tell
		 * whether they were one over-supervised stage or three ordinary ones.
		 */
		releaseStage: z.string().min(1).optional(),
		question: z.string().default(""),
		directive: z.string().default(""),
		requiredCorrections: z.array(z.string()).default([]),
		evidencePointers: z.array(z.string()).default([]),
		nextSafeAction: z.string().default(""),
	})
	.strict();
export type Receipt = z.infer<typeof ReceiptSchema>;

export interface ReceiptValidation {
	ok: boolean;
	errors: string[];
}

/**
 * Validate a receipt before it is written.
 *
 * The prose scan is not redundant with output-packet validation. A packet is
 * validated on the way IN from the supervisor; a receipt is assembled by the parent
 * from its own summary of that packet, so it is a second, unvalidated authoring
 * step. Without this scan the summary could assert an approval the packet was
 * refused for asserting.
 */
export function validateReceipt(candidate: unknown): ReceiptValidation {
	const parsed = ReceiptSchema.safeParse(candidate);
	if (!parsed.success) {
		return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
	}
	const r = parsed.data;
	const errors: string[] = [];

	const prose = [r.question, r.directive, r.reason, r.nextSafeAction, ...r.requiredCorrections].join(" ");
	errors.push(...scanAuthorityLanguage(prose));
	errors.push(...scanSecrets([prose, ...r.evidencePointers].join("\n")));

	// Mirrors the output-packet rule: returning work with nothing to change is not
	// actionable, and a receipt that records it that way hides an empty return.
	if (r.disposition === "RETURN_TO_EXECUTOR" && r.requiredCorrections.length === 0)
		errors.push("RETURN_TO_EXECUTOR requires at least one required correction");

	return { ok: errors.length === 0, errors };
}

/** `tasks/reports/{YYMMDD}-{slug}-advice-{n}.md`, per the contract's §8 storage rule. */
export function receiptPath(date: string, slug: string, n: number): string {
	if (!/^\d{6}$/.test(date)) throw new Error(`receipt date must be YYMMDD: ${JSON.stringify(date)}`);
	if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`receipt slug must be kebab-case: ${JSON.stringify(slug)}`);
	if (!Number.isInteger(n) || n < 1) throw new Error(`receipt index must be a positive integer: ${n}`);
	return `tasks/reports/${date}-${slug}-advice-${n}.md`;
}

const yamlScalar = (v: string): string => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const line = (v: string): string => v.replace(/\s+/g, " ").trim();

/**
 * Render the receipt. The not-verification sentence is verbatim from the contract
 * and part of the artifact: a receipt is the most re-readable supervision output,
 * so it is the one most likely to be mistaken for proof at a later gate.
 */
export function renderReceipt(receipt: Receipt): string {
	const corrections = receipt.requiredCorrections.length
		? receipt.requiredCorrections.map((c, i) => `${i + 1}. ${line(c)}`).join("\n")
		: "none";
	const pointers = receipt.evidencePointers.length ? receipt.evidencePointers.map((p) => `- ${p}`).join("\n") : "none";

	return `---
kind: advice-receipt
runId: ${yamlScalar(receipt.runId)}
stage: ${yamlScalar(receipt.stage)}
disposition: ${yamlScalar(receipt.disposition)}
outcome: ${yamlScalar(receipt.outcome)}
reason: ${yamlScalar(line(receipt.reason))}
taskId: ${yamlScalar(receipt.taskId)}
provider: ${yamlScalar(receipt.provider)}
skill: ${yamlScalar(receipt.skill)}
checkpointId: ${yamlScalar(receipt.checkpointId)}${receipt.releaseStage ? `\nreleaseStage: ${yamlScalar(receipt.releaseStage)}` : ""}
---

This is a record of supervision, NEVER verification and never a gate approval.

**Question asked:** ${line(receipt.question) || "(not recorded)"}

**Directive:** ${line(receipt.directive) || "(none)"}

**Required corrections:**

${corrections}

**Evidence pointers:**

${pointers}

**Next safe action:** ${line(receipt.nextSafeAction) || "(none recorded)"}
`;
}
