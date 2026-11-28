// hand-copied-kit-files-parity.test.ts — overlay files kept as hand-edited copies of a canonical
// `.claude/hooks/lib` file match it in everything but the lines each runtime is meant to change.
//
// `scripts/sync-hook-core.cjs` only covers byte-for-byte copies. These files differ per runtime in
// their comments, the kit directory they look under and the project-root variable they read, so
// they sit outside that sync and nothing else noticed when their logic drifted from the canonical
// file.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const LIB = ".claude/hooks/lib";

/** Lines a runtime copy may change: comments and the declared per-runtime settings. */
const PER_RUNTIME = [
	/^\s*(\/\/|\/\*\*|\*)/, // comment lines
	/^const KIT_DIRS = \[.*\];$/,
	/^\s*if \(process\.env\.\w+\) return process\.env\.\w+;$/,
];

function shared(rel: string): string[] {
	return readFileSync(join(ROOT, rel), "utf8")
		.split("\n")
		.filter((line) => !PER_RUNTIME.some((re) => re.test(line)));
}

const COPIES: Record<string, string[]> = {
	"validate-content.cjs": [
		"kit/overlays/codex/files/.codex/hooks/lib/validate-content.cjs",
		"kit/overlays/cursor/files/.cursor/hooks/lib/validate-content.cjs",
	],
	"skill-python.cjs": [
		"kit/overlays/agents/files/.agents/meowkit/scripts/skill-python.cjs",
		"kit/overlays/codex/files/.codex/scripts/skill-python.cjs",
		"kit/overlays/cursor/files/.cursor/scripts/skill-python.cjs",
		"kit/overlays/grok/files/.grok/meowkit/scripts/skill-python.cjs",
	],
};

describe("hand-copied kit files", () => {
	for (const [canonical, copies] of Object.entries(COPIES)) {
		for (const copy of copies) {
			it(`${copy} keeps the logic of ${LIB}/${canonical}`, () => {
				expect(shared(copy)).toEqual(shared(join(LIB, canonical)));
			});
		}
	}
});
