import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// MeowKit-native, Zod-validated review verdict proof-bundle (the machine-readable
// companion to the human `tasks/reviews/<slug>-verdict.md`). Adopts the deterministic
// proof-bundle PATTERN only — no ClaudeKit script port. Stays under tasks/ and is
// never injected into model context.

export const DimensionSchema = z
	.object({
		name: z.string().min(1),
		verdict: z.enum(["PASS", "WARN", "FAIL"]),
		note: z.string().optional(),
	})
	.passthrough();

export const VerdictSchema = z
	.object({
		schema_version: z.string(),
		slug: z.string().min(1),
		gate: z.enum(["review", "contract"]),
		decision: z.enum(["PASS", "PASS_WITH_RISK", "BLOCKED"]),
		dimensions: z.array(DimensionSchema),
		evidence_refs: z.array(z.string()).optional(),
		created_at: z.string(),
	})
	.passthrough();

export type Verdict = z.infer<typeof VerdictSchema>;

export type VerdictGateStatus = "pass" | "blocked" | "invalid" | "missing" | "legacy-md";

export interface VerdictGateResult {
	ok: boolean; // true → the gate passes (ship may proceed)
	status: VerdictGateStatus;
	decision?: string;
	errors: string[];
}

// Resolve a slug or explicit path to the verdict JSON path.
export function resolveVerdictPath(slugOrPath: string): string {
	if (slugOrPath.endsWith(".json")) return slugOrPath;
	if (slugOrPath.endsWith(".md")) return slugOrPath.replace(/\.md$/, ".json");
	return path.join("tasks", "reviews", `${slugOrPath}-verdict.json`);
}

// The gate. Pass on a valid PASS / PASS_WITH_RISK verdict. Block on BLOCKED,
// invalid JSON/schema, or total absence. Tolerate a legacy markdown-only verdict
// during the transition window (warn, but pass) so existing reviews keep shipping.
export function evaluateVerdictGate(slugOrPath: string): VerdictGateResult {
	const jsonPath = resolveVerdictPath(slugOrPath);
	const mdPath = jsonPath.replace(/\.json$/, ".md");

	if (!fs.existsSync(jsonPath)) {
		if (fs.existsSync(mdPath)) {
			return {
				ok: true,
				status: "legacy-md",
				errors: [`No verdict JSON at ${jsonPath}; markdown-only verdict tolerated during transition.`],
			};
		}
		return { ok: false, status: "missing", errors: [`No verdict found at ${jsonPath} (or sibling .md).`] };
	}

	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
	} catch (err) {
		return { ok: false, status: "invalid", errors: [`invalid JSON: ${(err as Error).message}`] };
	}

	const parsed = VerdictSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			ok: false,
			status: "invalid",
			errors: parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`),
		};
	}

	const { decision } = parsed.data;
	if (decision === "BLOCKED") {
		return { ok: false, status: "blocked", decision, errors: ["verdict decision is BLOCKED — Gate 2 blocks ship."] };
	}
	return { ok: true, status: "pass", decision, errors: [] };
}
