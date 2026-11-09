// Writing archive members to disk, with the destination boundary enforced by the
// one path-safety helper this codebase already has.
//
// There is deliberately no second traversal guard. Two guards drift: a rule
// tightened in one is not tightened in the other, and the weaker one is the one
// an attacker reaches. So both the kit archive and the legacy release zip are
// checked by `validateWritableTargetPath`, which rejects a target outside the
// boundary AND a target reached through a symlink component — the second being
// the case a string-prefix check misses entirely, because the path looks
// contained right up until the kernel follows the link.
//
// Member paths are also checked before resolution, because `..` and an absolute
// path are properties of the archive rather than of the filesystem, and an
// archive carrying either is malicious rather than unlucky.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

import { validateWritableTargetPath } from "../migrate/portable-installer-path-safety.js";

/** Whether a member path is structurally unfit to be joined to a destination. */
export function memberPathIsUnsafe(memberPath: string): boolean {
	if (memberPath === "" || memberPath.startsWith("/") || memberPath.startsWith("\\")) return true;
	if (isAbsolute(memberPath)) return true;
	// Drive-letter and UNC forms are absolute on Windows and relative-looking elsewhere.
	if (/^[A-Za-z]:/.test(memberPath)) return true;
	return memberPath.split(/[\\/]+/).includes("..");
}

/**
 * Resolve a member path inside `destination`, or return the reason it is unsafe.
 * The containment check is made on the resolved path as well, so a form the
 * structural check did not anticipate still cannot escape.
 */
export async function resolveSafeMemberPath(
	destination: string,
	memberPath: string,
): Promise<{ target: string } | { reason: string }> {
	if (memberPathIsUnsafe(memberPath)) {
		return { reason: `member path escapes the install directory: ${memberPath}` };
	}
	const root = resolve(destination);
	const target = join(root, memberPath.split("/").join(sep));
	if (target !== root && !target.startsWith(root + sep)) {
		return { reason: `member path escapes the install directory: ${memberPath}` };
	}
	const unsafe = await validateWritableTargetPath(target, { global: false, boundary: root });
	if (unsafe !== null) return { reason: `member path is not safe to write: ${memberPath}` };
	return { target };
}

/**
 * Write one member with the mode the archive recorded. The archive's mode is
 * derived from the file's own bytes rather than from the build machine, so
 * honouring it keeps a shipped script runnable without letting a build host's
 * umask decide what the user ends up with.
 */
export function writeMember(target: string, content: Buffer, mode: number): void {
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content, { mode });
}

/**
 * The mode to write content with when the archive records none it can be trusted
 * for. A zip's stored attributes come from whatever machine created it, so the
 * executable bit is taken from the content instead: a shebang is the only thing
 * that makes a file runnable on its own, and it is part of the content either
 * way.
 */
export function modeForContent(content: Buffer): number {
	return content.length >= 2 && content[0] === 0x23 && content[1] === 0x21 ? 0o755 : 0o644;
}
