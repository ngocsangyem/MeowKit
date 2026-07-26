// Athena strategy brief — what a DIRECT `@athena` consult returns.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md` §11.
//
// Athena is reachable two ways, and they are different capabilities:
//
//   embedded — a governed checkpoint inside one delivery run. Has a runId, a stage,
//              a cap, a dossier, a receipt, and a stage-legal `disposition` that
//              routes the workflow.
//   direct   — a stateless strategy consult. Someone asked a hard question and
//              wants judgement. There is no run to route, nothing to resume from,
//              and no cap bounding it.
//
// The brief is the direct half's output shape, and it deliberately CANNOT express a
// disposition. A disposition is a routing signal for a run; emitted without a run it
// reads as a governed decision that no run ever governed, and a later reader cannot
// tell the difference. That is the impersonation the route contract exists to stop —
// so the refusal lives in the schema, not in a reviewer's memory.
//
// Everything forbidden here is refused, never stripped: silently dropping a field
// the caller believed it returned leaves the caller trusting output that was never
// recorded.
import { z } from "zod";
import { OUTPUT_PACKET_MAX_WORDS, scanAuthorityLanguage, scanSecrets } from "./athena-supervision-packet.js";

/**
 * Fields that would turn a consult into a governed checkpoint. A brief carrying any
 * of them is refused with the field named, because the caller needs to know it tried
 * to claim supervision it never had.
 */
export const FORBIDDEN_BRIEF_FIELDS = [
	"disposition",
	"requiredCorrections",
	"runId",
	"supervisionRunId",
	"stage",
	"checkpointId",
	"receiptPointer",
	"receiptPointers",
	"correctionCount",
	"evidenceRevision",
	"strategicDirective",
] as const;

export const StrategyBriefSchema = z
	.object({
		/** What is actually going on, read from evidence rather than from the asker's framing. */
		situation: z.string().min(1),
		/** One recommended operational path, and why it beats the alternatives. */
		decisionRecommendation: z.string().min(1),
		/** What was considered and rejected. Absent alternatives usually means one was assumed. */
		rejectedAlternatives: z.string().default(""),
		/** The check that would prove the recommendation wrong. Advice with no such check is an opinion. */
		nextFalsifiableCheck: z.string().min(1),
		risksAndRollback: z.string().default(""),
		/** Where this stops being Athena's call. Required: a consult with no escalation point implies authority it lacks. */
		escalationPoint: z.string().min(1),
		assumptions: z.string().default(""),
		confidence: z.enum(["low", "medium", "high"]),
		evidenceRead: z.array(z.string()).default([]),
	})
	.strict();
export type StrategyBrief = z.infer<typeof StrategyBriefSchema>;

export interface BriefValidation {
	ok: boolean;
	errors: string[];
}

/**
 * Validate a direct-consult brief.
 *
 * The forbidden-field scan runs against the RAW candidate, before `.strict()` narrows
 * it: strict-mode rejects an unknown key with a generic message, and "you tried to
 * return a disposition from a stateless consult" is the message that matters.
 */
export function validateStrategyBrief(candidate: unknown): BriefValidation {
	const errors: string[] = [];

	if (candidate && typeof candidate === "object") {
		// `Object.getOwnPropertyNames`, not `Object.keys`: a non-enumerable property is
		// still a property, and zod's `.strict()` shares the same blind spot. Today the
		// only caller round-trips through `JSON.parse` (which cannot produce one), so
		// this is closing the gap before a future in-memory caller opens it — the claim
		// above says "refused", and a claim that holds only for JSON inputs is a
		// narrower claim than the one written.
		const keys = Object.getOwnPropertyNames(candidate as Record<string, unknown>);
		for (const forbidden of FORBIDDEN_BRIEF_FIELDS) {
			if (keys.includes(forbidden))
				errors.push(
					`"${forbidden}" belongs to embedded supervision — a direct consult is stateless and routes no workflow`,
				);
		}
	}

	const parsed = StrategyBriefSchema.safeParse(candidate);
	if (!parsed.success) {
		errors.push(...parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
		return { ok: false, errors };
	}
	const brief = parsed.data;

	const prose = [
		brief.situation,
		brief.decisionRecommendation,
		brief.rejectedAlternatives,
		brief.nextFalsifiableCheck,
		brief.risksAndRollback,
		brief.escalationPoint,
		brief.assumptions,
	].join(" ");

	const words = prose.trim() ? prose.trim().split(/\s+/).length : 0;
	if (words > OUTPUT_PACKET_MAX_WORDS)
		errors.push(`brief is ${words} words, over the ${OUTPUT_PACKET_MAX_WORDS}-word cap`);

	// A consult holds LESS authority than a checkpoint, not more — so it is held to
	// the same language bar, using the same single detector.
	errors.push(...scanAuthorityLanguage(prose));
	errors.push(...scanSecrets([prose, ...brief.evidenceRead].join("\n")));

	return { ok: errors.length === 0, errors };
}

// There is deliberately NO renderer here.
//
// A direct consult produces no durable artifact — that is the whole distinction from
// an embedded checkpoint, and it is structural (no runId ⇒ no dossier path, no
// receipt). A render function would therefore have no caller, and the previous slice
// already deleted two zero-caller helpers for exactly this reason: an unused export
// reads as a supported surface and invites someone to write the file the contract
// says is never written.
//
// The self-label lives where it is actually needed — in the agent adapter's Direct
// Consult section, so the reply itself says what it is.
