/**
 * `.plan-state.json` schema-1.3 additive `visual` block reader/writer.
 *
 * Verified reality: NO CLI code parses `.plan-state.json` today — schema "1.2"
 * lives in an agent-authored skill doc, and the file is agent-written. So this
 * module owns ONLY the `visual` block: it does a read-modify-write that
 * preserves every field it does not own (`phases`, `handoff`, and any unknown
 * key). It never invents the rest of the file; if the file is absent it writes
 * a minimal object carrying just the `visual` block (the schema-1.3 doc itself
 * lands in Phase 3).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { atomicWriteFileSync } from "./atomic-write.js";
import { artifactHash } from "./hashing.js";
import type { VisualPlan } from "../domain/schemas.js";

const PLAN_STATE_FILE = ".plan-state.json";
/** POSIX-style pointer stored in the artifact + plan-state (stable across OSes). */
const ARTIFACT_POINTER = "visual-plan/plan.json";

/** The additive `visual` pointer block (schema 1.3). Snake_case matches the file's style. */
export interface VisualBlock {
	schema: "visual-plan/v1";
	path: string;
	revision: number;
	hash: string;
	source_plan_hash: string;
	review_status: string;
	pending_feedback: string[];
}

/** Derive the `visual` block from the artifact + its on-disk hash. */
export function buildVisualBlock(plan: VisualPlan, planDir: string): VisualBlock {
	return {
		schema: "visual-plan/v1",
		path: ARTIFACT_POINTER,
		revision: plan.revision,
		hash: artifactHash(planDir, ARTIFACT_POINTER) ?? "",
		source_plan_hash: plan.source.planHash,
		review_status: plan.review.status,
		pending_feedback: [...plan.review.pendingFeedbackBatchIds],
	};
}

/** Read the whole `.plan-state.json` as an object, or `null` when absent/unparseable. */
export function readPlanState(planDir: string): Record<string, unknown> | null {
	const full = path.join(planDir, PLAN_STATE_FILE);
	let text: string;
	try {
		text = fs.readFileSync(full, "utf-8");
	} catch {
		return null;
	}
	try {
		const parsed = JSON.parse(text) as unknown;
		return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/**
 * Write the `visual` block into `.plan-state.json`, preserving every other
 * field (read-modify-write). Creates a minimal file if none exists.
 */
export function writeVisualBlock(planDir: string, visual: VisualBlock): void {
	const existing = readPlanState(planDir) ?? {};
	existing.visual = visual;
	atomicWriteFileSync(path.join(planDir, PLAN_STATE_FILE), `${JSON.stringify(existing, null, 2)}\n`);
}
