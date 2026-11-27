// Release versions are computed from tags, never typed into a pull request. These cases pin the
// rules the beta and stable workflows depend on.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const nv = require("../../scripts/release/next-version.cjs") as {
	compare: (a: string, b: string) => number;
	nextBeta: (tags: string[], messages: string[]) => { version: string; latestStable: string };
	stableTarget: (branch: string, tags: string[]) => { version: string; latestStable: string };
};

const TAGS = ["v3.1.0", "mewkit-v0.2.1", "v3.1.1", "v3.1.2-beta.1", "v3.1.2-beta.2"];

describe("compare", () => {
	it("orders prerelease numbers numerically and stable above its prereleases", () => {
		expect(nv.compare("3.1.2-beta.10", "3.1.2-beta.2")).toBeGreaterThan(0);
		expect(nv.compare("3.1.2", "3.1.2-beta.9")).toBeGreaterThan(0);
		expect(nv.compare("3.1.10", "3.1.9")).toBeGreaterThan(0);
	});
});

describe("nextBeta", () => {
	it("continues the beta series of the next patch on fix-only history", () => {
		expect(nv.nextBeta(TAGS, ["fix: a", "docs: b"]).version).toBe("3.1.2-beta.3");
	});

	it("moves to the next minor on a feat and starts at beta.1", () => {
		expect(nv.nextBeta(TAGS, ["fix: a", "feat(cli): b"]).version).toBe("3.2.0-beta.1");
	});

	it("moves to the next major on a breaking change", () => {
		expect(nv.nextBeta(TAGS, ["feat!: drop x"]).version).toBe("4.0.0-beta.1");
		expect(nv.nextBeta(TAGS, ["fix: a\n\nBREAKING CHANGE: y"]).version).toBe("4.0.0-beta.1");
	});

	it("never goes below a base an existing beta already used", () => {
		const tags = [...TAGS, "v3.2.0-beta.1"];
		expect(nv.nextBeta(tags, ["fix: only"]).version).toBe("3.2.0-beta.2");
	});

	it("restarts after a stable release of that base", () => {
		const tags = [...TAGS, "v3.1.2"];
		expect(nv.nextBeta(tags, ["fix: a"]).version).toBe("3.1.3-beta.1");
	});

	it("counts a beta whose binary published but whose kit did not as used", () => {
		expect(nv.nextBeta([...TAGS, "mewkit-v3.1.2-beta.3"], ["fix: a"]).version).toBe("3.1.2-beta.4");
	});

	it("is not moved by the old 0.x binary tags", () => {
		expect(nv.nextBeta([...TAGS, "mewkit-v0.2.1", "mewkit-v0.2.0-beta.1"], ["fix: a"]).version).toBe("3.1.2-beta.3");
	});
});

describe("stableTarget", () => {
	it("accepts a release or hotfix branch above the latest stable", () => {
		expect(nv.stableTarget("release/v3.2.0", TAGS).version).toBe("3.2.0");
		expect(nv.stableTarget("hotfix/v3.1.2", TAGS).version).toBe("3.1.2");
	});

	it("rejects a target not above the latest stable, an existing tag, or a bad branch", () => {
		expect(() => nv.stableTarget("release/v3.1.1", TAGS)).toThrow(/already tagged/);
		expect(() => nv.stableTarget("release/v3.3.0", [...TAGS, "mewkit-v3.3.0"])).toThrow(/already tagged/);
		expect(() => nv.stableTarget("release/v3.0.9", TAGS)).toThrow(/not greater/);
		expect(() => nv.stableTarget("release/3.2.0", TAGS)).toThrow(/not release/);
		expect(() => nv.stableTarget("release/v3.2.0-beta.1", TAGS)).toThrow(/not release/);
	});
});
