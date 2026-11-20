// shipped-references.test.ts — a file the kit ships names a repository path only when the kit
// ships that path too. An installed kit has neither this repository nor its unshipped files, so
// such a reference is one nobody can follow.

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ALLOWED, findings } = require("../scripts/check-shipped-references.cjs") as {
	ALLOWED: { path: string; why: string }[];
	findings: () => string[];
};

describe("references in shipped files", () => {
	it("name only paths the kit ships, or a listed exception", () => {
		expect(findings()).toEqual([]);
	});

	it("give every exception a reason", () => {
		for (const entry of ALLOWED) expect(entry.why.length, entry.path).toBeGreaterThan(10);
	});
});
