// Phase 6 slice 1: the unified provider-adapter view composes projection + acquisition +
// lifecycle + storage boundary. It must not invent claims — a report-only provider composes to
// report-only across the board.
import { describe, expect, it } from "vitest";
import { describeProvider, ADAPTED_PROVIDERS } from "../provider-adapter.js";
import { gatingEvents } from "../provider-lifecycle.js";

describe("describeProvider", () => {
	it("composes projection + acquisition + lifecycle + storage for an adapted provider", () => {
		const v = describeProvider("claude-code");
		expect(v.status).toBe("supported");
		expect(v.projection.levels.enforceable).toBe("supported");
		expect(v.acquisition.read?.tool).toBe("Read");
		expect(v.lifecycle.pre_tool.gate).toBe(true);
		expect(v.storageBoundary).toMatch(/tasks\/active/);
	});

	it("gatingEvents matches the lifecycle map's proven gates", () => {
		for (const p of ADAPTED_PROVIDERS) {
			expect(describeProvider(p).gatingEvents).toEqual(gatingEvents(p));
		}
	});

	it("codex composes to shell-mediated acquisition + no proven gate + enforcement gaps + advisory invocation", () => {
		const v = describeProvider("codex");
		expect(v.status).toBe("partial");
		expect(v.acquisition.status).toBe("partial");
		expect(v.gatingEvents).toEqual([]);
		expect(v.enforcementGaps.length).toBe(3); // pre_tool / prompt_submitted / stop unenforceable
		expect(v.invocation["invoke-skill"].support).toBe("advisory");
	});

	it("claude-code composes to one enforcement gap (prompt_submitted) + typed invocation shapes", () => {
		const v = describeProvider("claude-code");
		expect(v.enforcementGaps.map((g) => g.event)).toEqual(["prompt_submitted"]);
		expect(v.invocation["invoke-skill"].support).toBe("supported");
	});

	it("summary is the single capability headline: claude-code enforced/supported, codex advisory/partial", () => {
		const cc = describeProvider("claude-code").summary;
		expect(cc.supportState).toBe("supported");
		expect(cc.gatesProven).toBe(true);
		expect(cc.enforcement).toEqual({ gate1: "enforced", gate2: "enforced", secretProtection: "enforced" });

		const cx = describeProvider("codex").summary;
		expect(cx.supportState).toBe("partial");
		expect(cx.gatesProven).toBe(false);
		expect(cx.enforcement).toEqual({ gate1: "advisory", gate2: "advisory", secretProtection: "advisory" });
	});

	it("a report-only provider summarizes to unsupported enforcement (claims nothing)", () => {
		const s = describeProvider("some-future-runtime").summary;
		expect(s.supportState).toBe("unsupported");
		expect(s.enforcement).toEqual({ gate1: "unsupported", gate2: "unsupported", secretProtection: "unsupported" });
	});

	it("an unknown provider composes to report-only everywhere (claims nothing)", () => {
		const v = describeProvider("some-future-runtime");
		expect(v.status).toBe("report-only");
		expect(v.projection.levels.discoverable).toBe("unknown");
		expect(v.acquisition.read).toBeNull();
		expect(v.lifecycle.session_start.status).toBe("unknown");
		expect(v.gatingEvents).toEqual([]);
	});

	it("storage boundary is the cwd-keyed consumer tasks dir for every adapted provider (P4 decision)", () => {
		const boundaries = new Set(ADAPTED_PROVIDERS.map((p) => describeProvider(p).storageBoundary));
		expect(boundaries.size).toBe(1); // identical across providers — task state is consumer-project state
	});
});
