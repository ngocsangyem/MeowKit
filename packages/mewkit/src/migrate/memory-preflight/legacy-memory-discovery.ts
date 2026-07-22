// Walk the legacy `.claude/memory/` tree WITHOUT ever following a symlink. Symlinks
// (file OR directory) are recorded as entries so the plan can report them, but are
// never traversed — this closes the symlink-escape vector (a link pointing outside
// the legacy root can never pull foreign content into staging). Ordering is made
// deterministic by the inventory step's stable sort, not here.
import { lstatSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface DiscoveredFile {
	/** Path relative to the legacy root, POSIX-normalized. */
	relPath: string;
	absPath: string;
	isSymlink: boolean;
	/** Byte size for regular files; 0 for symlinks (never dereferenced). */
	size: number;
}

function toPosix(p: string): string {
	return sep === "/" ? p : p.split(sep).join("/");
}

/** Depth-first discovery. Returns regular files and symlinks; directories are
 *  recursed into only when they are real directories (never symlinked dirs). */
export function discoverLegacyMemory(legacyRoot: string): DiscoveredFile[] {
	const out: DiscoveredFile[] = [];

	function walk(dir: string): void {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return; // unreadable dir — nothing to record
		}
		for (const name of entries) {
			const abs = join(dir, name);
			let st: ReturnType<typeof lstatSync>;
			try {
				st = lstatSync(abs); // lstat: never dereferences the link
			} catch {
				continue;
			}
			const relPath = toPosix(relative(legacyRoot, abs));
			if (st.isSymbolicLink()) {
				out.push({ relPath, absPath: abs, isSymlink: true, size: 0 });
			} else if (st.isDirectory()) {
				walk(abs);
			} else if (st.isFile()) {
				out.push({ relPath, absPath: abs, isSymlink: false, size: st.size });
			}
			// Sockets/fifos/devices are ignored — not memory content.
		}
	}

	walk(legacyRoot);
	return out;
}
