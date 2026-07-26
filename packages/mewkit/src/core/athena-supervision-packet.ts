// Athena supervision packets — what crosses the context boundary, both ways.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md`.
// State machine: `athena-supervision-protocol.ts`.
//
// Every call is a fresh context fork, so the packet IS the supervisor's entire
// world. Two failure modes are guarded here:
//
//  1. Too much — a transcript, a full diff, or a memory dump pasted into the
//     packet reproduces the caller's context rot inside the fork and buries the
//     actual question. Caps and content checks fail LOUDLY before delegation
//     rather than silently truncating, because a truncated packet asks a
//     different question than the one intended.
//  2. Secrets — the supervisor is untrusted-input-only by design (Rule of Two).
//     A credential in a packet would make it untrusted-input AND sensitive-data.
//
// The output side additionally refuses approval language: counsel is evidence a
// human reads at a gate, never the approval itself.
import { z } from "zod";

/** Serialized input-packet ceiling. Exceeding it fails before any delegation. */
export const INPUT_PACKET_MAX_BYTES = 12 * 1024;
/** Evidence is a map, not a payload: pointers only, and few of them. */
export const MAX_EVIDENCE_POINTERS = 5;
/** Output prose ceiling. Volume is not rigor. */
export const OUTPUT_PACKET_MAX_WORDS = 600;
/** Corrections must be actionable and finite. */
export const MAX_REQUIRED_CORRECTIONS = 5;

/** A pointer path is a path, not a payload: single line, no control characters. */
export const MAX_POINTER_PATH_LENGTH = 512;
const POINTER_PATH_RE = /^[^\n\r\t\0]+$/;

/**
 * One evidence pointer. `provenance` is mandatory: an unattributed path cannot be
 * weighed, and "where did this come from" is exactly what a fresh fork cannot
 * reconstruct for itself.
 *
 * `path` is shape-constrained rather than free text. Content scanning skips it so a
 * legitimate filename like `fix-diff.md` is not mistaken for a diff — which means an
 * unconstrained `path` would be an unscanned smuggling channel wide enough for a PEM
 * block. The shape rule closes that; secrets are still scanned for separately.
 */
export const EvidencePointerSchema = z.object({
	path: z.string().min(1).max(MAX_POINTER_PATH_LENGTH).regex(POINTER_PATH_RE, "must be a single-line path"),
	relevance: z.string().min(1),
	provenance: z.string().min(1),
	summary: z.string().min(1),
});
export type EvidencePointer = z.infer<typeof EvidencePointerSchema>;

// `.strict()`: an unknown key would be an UNSCANNED field, which is the same class of
// hole as an unconstrained pointer path — and it would also make the byte cap a lie,
// since the caller serializes a shape larger than the one that was measured.
export const InputPacketSchema = z.strictObject({
	runId: z.string().min(1),
	skill: z.string().min(1),
	stage: z.enum(["GUIDE", "RESCUE", "REVIEW", "RECHECK"]),
	checkpointId: z.string().min(1),
	mission: z.string().min(1),
	lockedDecisions: z.array(z.string()).default([]),
	currentState: z.string().min(1),
	workerSummary: z.string().default(""),
	evidenceRefs: z.array(EvidencePointerSchema).max(MAX_EVIDENCE_POINTERS).default([]),
	priorDirective: z.string().nullable().default(null),
	question: z.string().min(1),
	riskAndReversibility: z.string().min(1),
});
export type InputPacket = z.infer<typeof InputPacketSchema>;

export const OutputPacketSchema = z.object({
	disposition: z.enum([
		"CONTINUE_WITH_DIRECTIVE",
		"READY_FOR_EXISTING_GATE",
		"RETURN_TO_EXECUTOR",
		"ESCALATE_TO_HUMAN",
		"BLOCKED_MISSING_EVIDENCE",
	]),
	strategicAssessment: z.string().default(""),
	decisionRecommendation: z.string().default(""),
	strategicDirective: z.string().default(""),
	requiredCorrections: z
		.array(z.object({ change: z.string().min(1), proofRequired: z.string().min(1) }))
		.max(MAX_REQUIRED_CORRECTIONS)
		.default([]),
	nextFalsifiableCheck: z.string().default(""),
	risksAndRollback: z.string().default(""),
	rejectedAlternatives: z.string().default(""),
	assumptions: z.string().default(""),
	confidence: z.enum(["low", "medium", "high"]),
	evidenceRead: z.array(z.string()).default([]),
});
export type OutputPacket = z.infer<typeof OutputPacketSchema>;

/** A rejected packet names every problem at once, so one round-trip fixes it. */
export interface PacketValidation {
	ok: boolean;
	errors: string[];
}

/** Patterns that mean "a payload was pasted where a pointer belongs". */
const BULK_CONTENT_PATTERNS: { name: string; re: RegExp }[] = [
	{ name: "unified diff", re: /^(?:diff --git |@@ -\d|\+\+\+ b\/)/m },
	{ name: "conversation transcript", re: /^\s*(?:User|Human|Assistant)\s*:/gm },
	{ name: "curated-memory dump", re: /##(?:decision|pattern|note):/g },
	{ name: "raw log dump", re: /^\s*at\s+\S+\s+\(.*:\d+:\d+\)\s*$/gm },
];

/**
 * Credential shapes. Deliberately narrow — a false positive here blocks a real
 * supervision call, so this matches assignment-like secrets and known key
 * headers rather than anything that merely looks high-entropy.
 */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
	{ name: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
	{ name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
	{ name: "bearer token", re: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}/ },
	{ name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
	{
		name: "secret assignment",
		re: /\b(?:api[_-]?key|secret|password|passwd|token|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{12,}/i,
	},
];

/** How many transcript/dialogue markers before it counts as a dump, not a quote. */
const TRANSCRIPT_TOLERANCE = 2;

/** Count non-overlapping matches for a global pattern. */
function countMatches(text: string, re: RegExp): number {
	if (!re.global) return re.test(text) ? 1 : 0;
	re.lastIndex = 0;
	return [...text.matchAll(re)].length;
}

/**
 * Credentials only. Separated from bulk-content scanning because the two have
 * different exemptions: a pointer path may legitimately be named `fix-diff.md`, but
 * nothing legitimately contains a private key. This runs over every field.
 */
export function scanSecrets(text: string): string[] {
	const found: string[] = [];
	for (const { name, re } of SECRET_PATTERNS) {
		if (countMatches(text, re) > 0) found.push(`${name} detected — a packet must never carry credentials`);
	}
	return found;
}

/**
 * Payloads pasted where a pointer belongs. Quoting one dialogue line as evidence is
 * legitimate; pasting a conversation is not, so repeat-count patterns get a small
 * tolerance while single-shot markers (a diff header) fail immediately.
 */
export function scanBulkContent(text: string): string[] {
	const found: string[] = [];
	for (const { name, re } of BULK_CONTENT_PATTERNS) {
		const hits = countMatches(text, re);
		if (re.global ? hits > TRANSCRIPT_TOLERANCE : hits > 0) found.push(`${name} detected — pass a pointer, not the payload`);
	}
	return found;
}

/** Both classes, for prose fields where neither is acceptable. */
export function scanForbiddenContent(text: string): string[] {
	return [...scanBulkContent(text), ...scanSecrets(text)];
}

/** Serialized byte length, which is what the cap is actually about. */
export function packetBytes(packet: unknown): number {
	return Buffer.byteLength(JSON.stringify(packet), "utf8");
}

/**
 * Validate an input packet before delegation: shape, byte cap, pointer budget,
 * provenance, and forbidden content. Schema errors are reported alongside the
 * content findings so a caller sees the whole picture in one pass.
 */
export function validateInputPacket(candidate: unknown): PacketValidation {
	const parsed = InputPacketSchema.safeParse(candidate);
	if (!parsed.success) {
		return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
	}
	const packet = parsed.data;
	const errors: string[] = [];

	const bytes = packetBytes(packet);
	if (bytes > INPUT_PACKET_MAX_BYTES)
		errors.push(`packet is ${bytes}B, over the ${INPUT_PACKET_MAX_BYTES}B cap — select fewer pointers`);

	// Bulk-content scanning covers author-supplied prose. Pointer PATHS are exempt from
	// it: `tasks/reports/fix-diff.md` legitimately names a diff without containing one.
	const prose = [
		packet.mission,
		packet.currentState,
		packet.workerSummary,
		packet.question,
		packet.riskAndReversibility,
		packet.priorDirective ?? "",
		...packet.lockedDecisions,
		...packet.evidenceRefs.map((e) => `${e.relevance} ${e.provenance} ${e.summary}`),
	].join("\n");
	errors.push(...scanBulkContent(prose));

	// Secret scanning has NO exemption and covers every field, paths included. The path
	// exemption above is about diff-shaped FILENAMES; it must never become a channel
	// that carries a credential past the boundary.
	errors.push(...scanSecrets([prose, ...packet.evidenceRefs.map((e) => e.path)].join("\n")));

	return { ok: errors.length === 0, errors };
}

/** Approval language, in any wording. Counsel routes work; it never clears a gate. */
const AUTHORITY_PATTERNS: { name: string; re: RegExp }[] = [
	{ name: "approval claim", re: /\b(?:approved|i approve|approving)\b/i },
	{ name: "clearance claim", re: /\b(?:cleared|clear to proceed|cleared to proceed|greenlit|sign(?:ed)?[- ]off)\b/i },
	{ name: "gate advancement", re: /\b(?:advance|unblock|pass|clear)\w*\s+gate\s*[12]\b/i },
	{ name: "merge or deploy authority", re: /\b(?:merge|deploy|ship)\s+(?:is\s+)?(?:approved|authorized|cleared)\b/i },
	{ name: "verification claim", re: /\bthis (?:counts as|is) verification\b/i },
];

/**
 * Validate a returned packet: shape, word cap, correction budget, and absence of
 * authority language. `RETURN_TO_EXECUTOR` additionally requires at least one
 * correction — returning work with nothing to change is not actionable.
 */
export function validateOutputPacket(candidate: unknown): PacketValidation {
	const parsed = OutputPacketSchema.safeParse(candidate);
	if (!parsed.success) {
		return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
	}
	const packet = parsed.data;
	const errors: string[] = [];

	const prose = [
		packet.strategicAssessment,
		packet.decisionRecommendation,
		packet.strategicDirective,
		packet.nextFalsifiableCheck,
		packet.risksAndRollback,
		packet.rejectedAlternatives,
		packet.assumptions,
		...packet.requiredCorrections.flatMap((c) => [c.change, c.proofRequired]),
	].join(" ");

	const words = prose.trim() ? prose.trim().split(/\s+/).length : 0;
	if (words > OUTPUT_PACKET_MAX_WORDS)
		errors.push(`output is ${words} words, over the ${OUTPUT_PACKET_MAX_WORDS}-word cap`);

	for (const { name, re } of AUTHORITY_PATTERNS) {
		if (re.test(prose)) errors.push(`${name} in counsel — say "the evidence supports X", never approve or clear`);
	}

	// The supervisor OPENS the files it was pointed at, so its own prose can quote their
	// contents back. Without this the return trip is laxer than the outbound one, and a
	// credential read from evidence would leave the boundary unchallenged.
	errors.push(...scanSecrets([prose, ...packet.evidenceRead].join("\n")));

	if (packet.disposition === "RETURN_TO_EXECUTOR" && packet.requiredCorrections.length === 0)
		errors.push("RETURN_TO_EXECUTOR requires at least one required correction");

	return { ok: errors.length === 0, errors };
}
