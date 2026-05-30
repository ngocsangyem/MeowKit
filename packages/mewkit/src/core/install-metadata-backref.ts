// One-way bridge from a migration source to the installed metadata it was
// exported from. `mewkit migrate --install` stamps portable-registry entries
// with these back-references; absent or corrupt source metadata yields null so
// a migration is never failed or altered by the bridge.
import { relative, join, isAbsolute } from "node:path";
import { readInstallMetadata, indexByPath, type InstallFileEntry } from "./install-metadata.js";

export interface InstalledBackRef {
	version: string | null;
	entriesByPath: Record<string, InstallFileEntry>;
	sourceClaudeDir: string;
}

/** Build a back-reference from the migration source root, or null if no installed metadata. */
export function buildInstalledBackRef(sourceRoot: string): InstalledBackRef | null {
	const sourceClaudeDir = join(sourceRoot, ".claude");
	try {
		const read = readInstallMetadata(sourceClaudeDir);
		if (read.source === "none" || !read.meta) return null;
		return {
			version: read.meta.version || null,
			entriesByPath: indexByPath(read.meta.files),
			sourceClaudeDir,
		};
	} catch {
		return null; // corrupt source metadata is not worth failing a migration over
	}
}

/** Resolve the back-ref fields for one exported asset; omits fields that are unavailable. */
export function resolveInstalledBackRef(
	backRef: InstalledBackRef | null,
	absSourcePath: string,
): { installedVersion?: string; installedChecksum?: string } {
	if (!backRef) return {};
	const out: { installedVersion?: string; installedChecksum?: string } = {};
	if (backRef.version) out.installedVersion = backRef.version;
	const rel = relative(backRef.sourceClaudeDir, absSourcePath);
	if (rel && !rel.startsWith("..") && !isAbsolute(rel)) {
		const entry = backRef.entriesByPath[rel];
		if (entry) out.installedChecksum = entry.checksum;
	}
	return out;
}
