/**
 * Filesystem gateway for the canonical visual artifact.
 *
 * The artifact always lives at `<plan-dir>/visual-plan/plan.json`. All access
 * goes through realpath containment: the resolved artifact path MUST stay
 * inside the resolved plan directory, so a symlinked `visual-plan/` cannot
 * redirect reads/writes outside the plan (non-functional requirement: no path
 * escapes the plan directory). Writes are atomic (same-dir tmp + rename).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { err, ErrorCode, type ValidationError } from "../domain/errors.js";
import { atomicWriteFileSync } from "./atomic-write.js";

/** Artifact location relative to the plan directory. */
export const ARTIFACT_REL_PATH = path.join("visual-plan", "plan.json");

/** Thrown when a plan directory or artifact path fails containment/existence checks. */
export class PlanPathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PlanPathError";
	}
}

/** Resolve `input` to an existing directory's realpath. Throws `PlanPathError` otherwise. */
export function resolvePlanDir(input: string): string {
	const abs = path.resolve(input);
	let real: string;
	try {
		real = fs.realpathSync(abs);
	} catch {
		throw new PlanPathError(`plan directory not found: ${abs}`);
	}
	if (!fs.statSync(real).isDirectory()) {
		throw new PlanPathError(`not a directory: ${real}`);
	}
	return real;
}

/** True when `candidate`'s realpath is `planDir` itself or strictly inside it. */
function isContained(candidate: string, realPlan: string): boolean {
	const real = fs.realpathSync(candidate);
	return real === realPlan || real.startsWith(realPlan + path.sep);
}

/** Absolute artifact path, guaranteed contained within `planDir` (realpath checks). */
export function artifactPath(planDir: string): string {
	const full = path.resolve(planDir, ARTIFACT_REL_PATH);
	const rel = path.relative(planDir, full);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		throw new PlanPathError(`artifact path escapes plan directory: ${full}`);
	}
	const realPlan = fs.realpathSync(planDir);
	// Guard against a symlinked visual-plan/ directory redirecting outside the plan dir.
	const dir = path.dirname(full);
	if (fs.existsSync(dir) && !isContained(dir, realPlan)) {
		throw new PlanPathError(`visual-plan directory resolves outside the plan directory: ${fs.realpathSync(dir)}`);
	}
	// Guard against a symlinked plan.json file redirecting reads outside the plan dir.
	if (fs.existsSync(full) && !isContained(full, realPlan)) {
		throw new PlanPathError(`artifact file resolves outside the plan directory: ${fs.realpathSync(full)}`);
	}
	return full;
}

/** True when an artifact file exists for this plan directory. */
export function artifactExists(planDir: string): boolean {
	return fs.existsSync(artifactPath(planDir));
}

export interface RawArtifactRead {
	raw?: unknown;
	error?: ValidationError;
}

/** Read + JSON-parse the artifact. Missing/invalid file yields a typed error, never a throw. */
export function readArtifactRaw(planDir: string): RawArtifactRead {
	const full = artifactPath(planDir);
	let text: string;
	try {
		text = fs.readFileSync(full, "utf-8");
	} catch {
		return { error: err(ARTIFACT_REL_PATH, ErrorCode.ARTIFACT_MISSING, `no visual artifact at ${ARTIFACT_REL_PATH}`) };
	}
	try {
		return { raw: JSON.parse(text) as unknown };
	} catch (e) {
		const detail = e instanceof Error ? e.message : String(e);
		return { error: err(ARTIFACT_REL_PATH, ErrorCode.ARTIFACT_INVALID_JSON, `artifact is not valid JSON: ${detail}`) };
	}
}

/**
 * Canonical on-disk serialization for the artifact (pretty JSON + trailing
 * newline). Exposed so a caller can hash the EXACT bytes a subsequent
 * `writeArtifact` will persist (used by prepare-feedback for a crash-safe
 * batch-then-artifact write order).
 */
export function serializeArtifact(artifact: unknown): string {
	return `${JSON.stringify(artifact, null, 2)}\n`;
}

/** Atomically write the artifact as canonical pretty JSON. */
export function writeArtifact(planDir: string, artifact: unknown): void {
	atomicWriteFileSync(artifactPath(planDir), serializeArtifact(artifact));
}
