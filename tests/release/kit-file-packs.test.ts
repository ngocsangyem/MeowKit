// The opt-in eval pack ships under kit/packs/eval/, never inside the archive's
// .claude/ tree, which every binary (older ones included) installs whole.
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { REPO, shipSetView } from "./helpers/ship-set-view.js";

const require = createRequire(import.meta.url);
const shipSet = require(`${REPO}/scripts/kit-ship-set.cjs`) as {
	filePackFiles: (root: string) => { from: string; to: string }[];
};

describe("kit file packs", () => {
	const files = shipSet.filePackFiles(REPO);
	const isCase = (path: string) => /^\.claude\/skills\/[^/]+\/eval\//.test(path);

	it("carries every tracked eval case, fixtures included, at kit/packs/eval/", () => {
		const tracked = shipSetView().tracked.filter(isCase).sort();
		expect(files.map((f) => f.from).sort()).toEqual(tracked);
		for (const { from, to } of files) {
			expect(to).toBe(`kit/packs/eval/${from.slice(".claude/skills/".length)}`);
		}
		expect(files.some((f) => f.to.endsWith("/test/calc.test.js"))).toBe(true);
	});

	it("leaves the cases out of the archive's .claude/ tree", () => {
		expect(shipSetView().shipped.filter(isCase)).toEqual([]);
	});
});
