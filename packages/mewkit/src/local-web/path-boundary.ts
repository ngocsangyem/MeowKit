/**
 * Realpath-based path containment — fail-closed.
 *
 * Behavior extracted verbatim from the loopback write pipeline's boundary
 * checks: `safeRealpath` resolves symlinks and returns null on ANY error (the
 * caller MUST treat null as denied), and `isContainedPath` verifies a resolved
 * child sits at or strictly inside a resolved parent. Together they stop a
 * symlinked entry from redirecting reads/writes outside an allowed root.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Resolve `p` to a realpath, or null on any failure (fail-closed). */
export function safeRealpath(p: string): string | null {
	try {
		return fs.realpathSync(p);
	} catch {
		return null;
	}
}

/** True when `childRealpath` is `parentRealpath` itself or strictly inside it. */
export function isContainedPath(childRealpath: string, parentRealpath: string): boolean {
	return childRealpath === parentRealpath || childRealpath.startsWith(parentRealpath + path.sep);
}

/**
 * Resolve `child` and verify it is contained within `parent` (already-resolved
 * or resolvable). Returns the child's realpath on success, or null when either
 * realpath fails or containment is violated.
 */
export function resolveContained(parent: string, child: string): string | null {
	const parentReal = safeRealpath(parent);
	if (!parentReal) return null;
	const childReal = safeRealpath(child);
	if (!childReal) return null;
	return isContainedPath(childReal, parentReal) ? childReal : null;
}
