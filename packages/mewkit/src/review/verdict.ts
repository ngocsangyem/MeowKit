import type { EvidenceLevel } from "./schema.js";

// Deterministic verdict cap table (Phase 6). The composed decision is a PURE function
// of the session's evidence — no model judgment at this layer. `decision` uses ONLY the
// verdict-schema enum (PASS | PASS_WITH_RISK | BLOCKED); there is no WARN decision
// (per-dimension WARN/FAIL lives at the dimension level). A confirmed Critical blocks;
// any risk state caps below Approve/PASS. Only a clean, session-observed, green session
// earns Approve/PASS.

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
export type Decision = "PASS" | "PASS_WITH_RISK" | "BLOCKED";

export interface VerdictInput {
	confirmedCritical: boolean; // ≥1 verified CRITICAL finding
	coverageComplete: boolean; // reviewer coverage gaps closed
	evidenceLevel: EvidenceLevel; // session-observed | attested
	ciRed: boolean;
	ciAllSkipped: boolean;
	contextUnavailable: string[]; // degraded capture recorded in the manifest
	selfPR: boolean; // PR author == reviewing identity
}

export interface ComputedVerdict {
	decision: Decision;
	event: ReviewEvent;
	reasons: string[]; // why the outcome was capped (disclosed in the verdict body)
}

export function computeVerdict(input: VerdictInput): ComputedVerdict {
	// Hard block: a confirmed Critical finding is the top of the table.
	if (input.confirmedCritical) return { decision: "BLOCKED", event: "REQUEST_CHANGES", reasons: ["confirmed Critical finding"] };

	// Risk states — each caps the outcome below Approve/PASS to Comment/PASS_WITH_RISK.
	const reasons: string[] = [];
	if (!input.coverageComplete) reasons.push("incomplete reviewer coverage");
	if (input.evidenceLevel !== "session-observed") reasons.push(`evidence level: ${input.evidenceLevel} — Approve unavailable`);
	if (input.ciRed) reasons.push("CI red");
	if (input.ciAllSkipped) reasons.push("all CI checks skipped");
	for (const c of input.contextUnavailable) reasons.push(`context unavailable: ${c}`);
	if (input.selfPR) reasons.push("self-authored PR");

	if (reasons.length === 0) return { decision: "PASS", event: "APPROVE", reasons: [] };
	return { decision: "PASS_WITH_RISK", event: "COMMENT", reasons };
}
