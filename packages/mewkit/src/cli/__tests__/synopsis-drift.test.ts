// Keeps the generated flag reference in the docs identical to the catalogue.
//
// Run with `MEOWKIT_WRITE_SYNOPSIS=1` to regenerate rather than assert — the same
// generate-or-verify shape the capability view uses, so there is no separate build step to
// remember and no way to land a catalogue change with stale docs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderSynopsis, SYNOPSIS_START, SYNOPSIS_END } from "../render-synopsis.js";

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = join(here, "..", "..", "..", "..", "docs", "content", "docs", "cli", "index.mdx");

describe("generated CLI flag reference", () => {
	it("matches the catalogue", () => {
		if (!existsSync(TARGET)) return; // docs package absent in a consumer checkout

		const body = readFileSync(TARGET, "utf-8");
		const start = body.indexOf(SYNOPSIS_START);
		const end = body.indexOf(SYNOPSIS_END);
		expect(start, `${SYNOPSIS_START} missing from cli/index.mdx`).toBeGreaterThan(-1);
		expect(end, `${SYNOPSIS_END} missing from cli/index.mdx`).toBeGreaterThan(start);

		const current = body.slice(start, end + SYNOPSIS_END.length);
		const expected = renderSynopsis();

		if (process.env.MEOWKIT_WRITE_SYNOPSIS === "1") {
			writeFileSync(TARGET, body.slice(0, start) + expected + body.slice(end + SYNOPSIS_END.length), "utf-8");
			return;
		}

		expect(
			current,
			"CLI docs are stale — regenerate with MEOWKIT_WRITE_SYNOPSIS=1 npx vitest run packages/mewkit/src/cli",
		).toBe(expected);
	});

	it("touches nothing outside the markers", () => {
		if (!existsSync(TARGET)) return;
		const body = readFileSync(TARGET, "utf-8");
		// Editorial content above the markers is the author's; the generator must never reach it.
		expect(body.indexOf("## Find a command")).toBeLessThan(body.indexOf(SYNOPSIS_START));
		expect(body.split(SYNOPSIS_START).length - 1, "marker must appear exactly once").toBe(1);
	});
});
