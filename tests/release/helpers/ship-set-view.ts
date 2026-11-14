// The two views of the published kit that the artifact tests are written against.
//
// Kept in one place because the two disagree on purpose and both are needed. The
// TRACKED view answers "what authored content does the archive carry", and is the
// only view that can also assert a file is still in the checkout. The MATCHER view
// answers "would this path be withheld", and is the only view that sees content git
// never tracked — which is exactly how a hook log, a pytest cache and this
// repository's own evaluator memory were reaching every install.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface ShipSetModule {
	ARCHIVE_TARGETS: string[];
	excludeMatcher: (patterns: string[]) => (rel: string) => boolean;
	shipSetExclusions: (root: string) => string[];
}

const require = createRequire(import.meta.url);

/** The repository root, two levels up from `tests/release/helpers/`. */
export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const shipSet = require(join(REPO, "scripts", "kit-ship-set.cjs")) as ShipSetModule;

/** The archive roots, as the matcher sees them: repo-relative with forward slashes. */
const ARCHIVE_ROOTS = shipSet.ARCHIVE_TARGETS.map((target) => target.replace(/\\/g, "/"));

/** A path is under a root when it IS that root (a file) or sits inside it (a directory). */
function underArchiveRoot(path: string): boolean {
	return ARCHIVE_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
}

export interface ShipSetView {
	/** `base.exclude`, verbatim — the one source of what the kit withholds. */
	patterns: string[];
	/** True when the archive matcher would withhold this repo-relative path. */
	isExcluded: (path: string) => boolean;
	/** Every path the repository tracks. */
	tracked: string[];
	/** What the archive carries: tracked, under an archive root, not excluded. */
	shipped: string[];
}

export function shipSetView(): ShipSetView {
	const patterns = shipSet.shipSetExclusions(REPO);
	const isExcluded = shipSet.excludeMatcher(patterns);
	const tracked = execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
		.split("\n")
		.filter((line) => line !== "");
	const shipped = tracked.filter((path) => underArchiveRoot(path) && !isExcluded(path));
	return { patterns, isExcluded, tracked, shipped };
}
