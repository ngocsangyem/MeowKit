import { z } from "zod";

// Zod schemas for the curated-memory stores. Source of truth = the live v2.0.0
// JSON shape (EMPTY_SKELETON in commands/memory.ts) + immediate-capture-handler.
// Design rules:
//  - `.passthrough()` everywhere → unknown/future fields are kept, never rejected
//    (additive forward-compat: current data must validate clean).
//  - Only the structurally load-bearing fields are required (id, version, scope,
//    consumer) so legacy entries captured before richer fields existed still pass.
//  - Validators WARN on soft issues; they never hard-fail valid v2.0.0 data.

const Metadata = z
	.object({
		created: z.string().optional(),
		last_updated: z.string().optional(),
	})
	.passthrough();

// Per-pattern entry for fixes / review-patterns / architecture-decisions.
export const PatternSchema = z
	.object({
		id: z.string().min(1),
		type: z.string().optional(),
		category: z.string().optional(),
		severity: z.string().optional(),
		domain: z.array(z.string()).optional(),
		applicable_when: z.string().optional(),
		context: z.string().optional(),
		pattern: z.string().optional(),
		frequency: z.number().optional(),
		lastSeen: z.string().optional(),
		timestamp: z.string().optional(),
	})
	.passthrough();

export type Pattern = z.infer<typeof PatternSchema>;

// Curated pattern store (fixes, review-patterns, architecture-decisions).
function patternStore(scope: string) {
	return z
		.object({
			version: z.string(),
			scope: z.literal(scope),
			consumer: z.string(),
			patterns: z.array(PatternSchema),
			metadata: Metadata.optional(),
		})
		.passthrough();
}

export const FixesSchema = patternStore("fixes");
export const ReviewPatternsSchema = patternStore("review-patterns");
export const ArchitectureDecisionsSchema = patternStore("architecture-decisions");

// Security findings store — narrative shape, not the pattern shape.
export const SecurityFindingSchema = z
	.object({
		id: z.string().min(1),
		finding: z.string(),
		severity: z.string().optional(),
		evidence: z.string().optional(),
		status: z.string().optional(),
		lastSeen: z.string().optional(),
	})
	.passthrough();

export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

export const SecurityFindingsSchema = z
	.object({
		version: z.string(),
		scope: z.literal("security-findings"),
		consumer: z.string(),
		findings: z.array(SecurityFindingSchema),
		metadata: Metadata.optional(),
	})
	.passthrough();

export interface StoreSpec {
	file: string;
	scope: string;
	schema: z.ZodTypeAny;
	// Which array holds the entries + which entry text fields get the
	// validate-content injection recheck.
	itemsKey: "patterns" | "findings";
	textFields: string[];
}

// The four curated stores. `trace-event` is intentionally excluded — its writer
// is bash (append-trace.sh) and readers are bash/python, so a TS schema would be
// inert and would drift from the real writer.
export const CURATED_STORES: StoreSpec[] = [
	{ file: "fixes.json", scope: "fixes", schema: FixesSchema, itemsKey: "patterns", textFields: ["pattern", "context"] },
	{
		file: "review-patterns.json",
		scope: "review-patterns",
		schema: ReviewPatternsSchema,
		itemsKey: "patterns",
		textFields: ["pattern", "context"],
	},
	{
		file: "architecture-decisions.json",
		scope: "architecture-decisions",
		schema: ArchitectureDecisionsSchema,
		itemsKey: "patterns",
		textFields: ["pattern", "context"],
	},
	{
		file: "security-findings.json",
		scope: "security-findings",
		schema: SecurityFindingsSchema,
		itemsKey: "findings",
		textFields: ["finding", "evidence"],
	},
];
