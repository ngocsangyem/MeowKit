import { z } from "zod";

// Typed contract for the high-assurance PR-review pipeline (ReviewSession).
// This file is the CANONICAL schema; every `mewkit review *` command imports from
// here — no per-command re-declarations. The worktree `review-pr` action (a
// CommonJS script that cannot import this module) writes a manifest whose shape is
// asserted against ReviewManifestSchema by a parity test, so the .cjs boundary and
// this contract cannot silently drift.
//
// Design rules (match memory/verdict-schema.ts + memory/schemas.ts):
//  - `.passthrough()` everywhere → unknown/future fields are kept (additive
//    forward-compat), never rejected.
//  - Only structurally load-bearing fields are required.
//  - Severity/decision vocab matches mk:review (CRITICAL/MAJOR/MINOR) and
//    verdict-schema.ts (PASS/PASS_WITH_RISK/BLOCKED) so verdicts stay compatible.

export const SEVERITY = ["CRITICAL", "MAJOR", "MINOR"] as const;
export const CONFIDENCE = ["HIGH", "MEDIUM", "LOW"] as const;

export const SeveritySchema = z.enum(SEVERITY);
export const ConfidenceSchema = z.enum(CONFIDENCE);

// Review-level decision — identical enum to verdict-schema.ts (I3: there is NO
// decision-level WARN; residual risk maps to PASS_WITH_RISK).
export const ReviewDecisionSchema = z.enum(["PASS", "PASS_WITH_RISK", "BLOCKED"]);

// Hosts the pipeline can write to. github only for v1; unsupported hosts stay
// review-only (Phase 6). Extensible without breaking existing manifests.
export const ReviewHostSchema = z.enum(["github"]);

// The SHA-bound worktree ownership record. Canonical location:
// tasks/reviews/<session>/manifest.json — it must survive worktree removal so
// cleanup / coverage / compose can read it. The nonce is the cleanup guard.
export const ReviewManifestSchema = z
	.object({
		schemaVersion: z.string().min(1),
		session: z.string().min(1),
		nonce: z.string().min(1),
		// worktreePath / ref are constrained to the review namespace: they reach git
		// and the filesystem, and a review worktree hosts untrusted PR code that can
		// tamper the on-disk manifest. Format-pinning here mirrors the .cjs boundary
		// check (worktree-review-pr.cjs assertManifestShape) — defense-in-depth on top
		// of that action's array-argv git exec.
		worktreePath: z.string().regex(/^\.worktrees\/review-pr-\d+-[A-Za-z0-9._-]+$/),
		pr: z.number().int().positive(),
		ref: z.string().regex(/^refs\/mewkit\/review-pr-\d+-[A-Za-z0-9._-]+$/),
		headSha: z.string().min(1),
		baseSha: z.string().min(1),
		baseBranch: z.string().min(1),
		// Remote bound to the PR's BASE owner/repo — never a fork remote, even when
		// the head branch lives on a fork (pull/N/head exists only on the base remote).
		baseRemote: z.string().min(1),
		host: ReviewHostSchema,
		owner: z.string().min(1),
		repo: z.string().min(1),
		createdAt: z.string().min(1),
		// Added by `mewkit review prepare` (the worktree action writes the base manifest
		// without these). diffSha256 makes the captured diff tamper-evident — compose /
		// coverage re-hash before trusting diff.patch. contextUnavailable records degraded
		// capture (gh rate limit / missing scope) so Phase 6 can cap the verdict.
		diffSha256: z.string().optional(),
		contextUnavailable: z.array(z.string()).optional(),
	})
	.passthrough();

// Evidence level for a review session. `session-observed` = CLI read receipts
// corroborated by the real Bash PostToolUse hook (only achievable for the driving
// session's own Bash — see phase-04-capability-spike). `attested` = CLI receipts
// only (subagent reviews / host without active hook); Phase 6 caps Approve on it.
export const EVIDENCE_LEVELS = ["session-observed", "attested"] as const;
export const EvidenceLevelSchema = z.enum(EVIDENCE_LEVELS);

// One coverage event (Phase 4 recorder). `source: "cli"` = written by the read
// wrapper; `source: "hook"` = tagged by the Bash PostToolUse handler. Corroborating
// the two by (session, target) upgrades a read to session-observed. `reviewer` is a
// caller-supplied ROLE label for aggregation, NOT an authenticated subagent identity.
export const EvidenceEventSchema = z
	.object({
		session: z.string().min(1),
		kind: z.string().min(1), // "read" | "launch" | ...
		target: z.string().optional(),
		at: z.string().min(1),
		reviewer: z.string().optional(),
		source: z.enum(["cli", "hook"]).optional(),
	})
	.passthrough();

// One review finding.
export const FindingSchema = z
	.object({
		location: z.string().min(1),
		failureScenario: z.string().min(1),
		severity: SeveritySchema,
		confidence: ConfidenceSchema,
		suggestedDirection: z.string().optional(),
	})
	.passthrough();

// Per-dimension verdict state — dimension enum matches verdict-schema.ts.
export const DimensionStateSchema = z
	.object({
		name: z.string().min(1),
		verdict: z.enum(["PASS", "WARN", "FAIL"]),
		note: z.string().optional(),
	})
	.passthrough();

// The review's decision + dimensions + findings.
export const VerdictStateSchema = z
	.object({
		decision: ReviewDecisionSchema,
		dimensions: z.array(DimensionStateSchema),
		findings: z.array(FindingSchema).default([]),
	})
	.passthrough();

// What a --reply submit sends to the host (Phase 6). headSha binds the submit to
// the exact reviewed revision; a stale SHA must refuse.
export const SubmitPayloadSchema = z
	.object({
		host: ReviewHostSchema,
		owner: z.string().min(1),
		repo: z.string().min(1),
		pr: z.number().int().positive(),
		headSha: z.string().min(1),
		event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
		body: z.string(),
	})
	.passthrough();

// Top-level pipeline record joining manifest + evidence + verdict.
export const ReviewSessionSchema = z
	.object({
		schemaVersion: z.string().min(1),
		session: z.string().min(1),
		manifest: ReviewManifestSchema,
		evidence: z.array(EvidenceEventSchema).default([]),
		verdict: VerdictStateSchema.optional(),
	})
	.passthrough();

export type Severity = z.infer<typeof SeveritySchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type ReviewHost = z.infer<typeof ReviewHostSchema>;
export type ReviewManifest = z.infer<typeof ReviewManifestSchema>;
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;
export type EvidenceEvent = z.infer<typeof EvidenceEventSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type DimensionState = z.infer<typeof DimensionStateSchema>;
export type VerdictState = z.infer<typeof VerdictStateSchema>;
export type SubmitPayload = z.infer<typeof SubmitPayloadSchema>;
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;

// Parse helpers — `parseX` throws on invalid (use at trusted boundaries);
// `safeParseX` returns a discriminated result (use when the caller handles errors).
export const parseReviewManifest = (json: unknown): ReviewManifest => ReviewManifestSchema.parse(json);
export const safeParseReviewManifest = (json: unknown) => ReviewManifestSchema.safeParse(json);

export const parseEvidenceEvent = (json: unknown): EvidenceEvent => EvidenceEventSchema.parse(json);
export const safeParseEvidenceEvent = (json: unknown) => EvidenceEventSchema.safeParse(json);

export const parseFinding = (json: unknown): Finding => FindingSchema.parse(json);
export const safeParseFinding = (json: unknown) => FindingSchema.safeParse(json);

export const parseVerdictState = (json: unknown): VerdictState => VerdictStateSchema.parse(json);
export const safeParseVerdictState = (json: unknown) => VerdictStateSchema.safeParse(json);

export const parseSubmitPayload = (json: unknown): SubmitPayload => SubmitPayloadSchema.parse(json);
export const safeParseSubmitPayload = (json: unknown) => SubmitPayloadSchema.safeParse(json);

export const parseReviewSession = (json: unknown): ReviewSession => ReviewSessionSchema.parse(json);
export const safeParseReviewSession = (json: unknown) => ReviewSessionSchema.safeParse(json);
