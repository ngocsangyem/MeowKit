import { describe, expect, it } from "vitest";
import { formatMcpIncludeRerunCommand } from "../migrate-ui-summary.js";

describe("--include-mcp re-run command", () => {
	it("appends --include-mcp to the original invocation", () => {
		expect(formatMcpIncludeRerunCommand(["mewkit", "migrate", "codex"])).toBe("mewkit migrate codex --include-mcp");
	});

	it("preserves other flags and only adds --include-mcp once", () => {
		expect(formatMcpIncludeRerunCommand(["mewkit", "migrate", "codex", "--yes", "--include-mcp"])).toBe(
			"mewkit migrate codex --yes --include-mcp",
		);
	});
});
