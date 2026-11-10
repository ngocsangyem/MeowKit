// The one place the supported Node major lives.
//
// The repository used to state three different floors: the package engines said 24, the
// README said 20, and `doctor` checked for 20 and labelled itself "Node.js >= 20". A user
// on Node 20 therefore read a supported version, passed the diagnostic, and then hit an
// install that the package manager itself refused. Three statements, one of which had to
// be wrong, and nothing that could tell which.
//
// The number is the lowest Node the test matrix actually runs, because a floor nothing
// exercises is a guess. Everything that states a floor — the diagnostic, its label, and
// the alignment test that reads the manifests, the README and the workflow files — reads
// it from here, so the next change moves one constant instead of four sentences.
export const NODE_FLOOR_MAJOR = 24;

/** `>=24`, as `engines.node` spells it. */
export const NODE_FLOOR_ENGINES = `>=${NODE_FLOOR_MAJOR}`;

/** "Node.js 24+", as prose spells it. */
export const NODE_FLOOR_PROSE = `Node.js ${NODE_FLOOR_MAJOR}+`;

/** The running major, for a check that wants to compare rather than re-parse. */
export function runningNodeMajor(version = process.versions.node): number {
	return parseInt(version.split(".")[0] ?? "0", 10);
}
