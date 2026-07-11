// Phase 3 slice 1: typed availability adapters + host-aware resolve. Probes are injected
// so every case is deterministic. Adapters never execute a capability's script and never
// infer host_tool/subagent/lifecycle from PATH — those stay honestly `unknown`.
import { describe, expect, it } from "vitest";
import { computeAvailability, rollUpInvocability, type AvailabilityContext, type AvailabilityProbes } from "../availability.js";
import { resolveWithHost } from "../resolve-capabilities.js";
import type { CapabilityEntry, TypedRequirement } from "../capability.js";

function cap(id: string, requirements: TypedRequirement[], over: Partial<CapabilityEntry> = {}): CapabilityEntry {
	return {
		id,
		kind: "skill",
		description: "",
		aliases: [],
		sourcePath: `skills/${id}/SKILL.md`,
		inventoryId: id,
		owner: "lifecycle",
		installedState: "installed",
		intents: [`do ${id}`],
		whenToUse: null,
		invocation: { kind: "skill", id: "invoke-skill" },
		requirements,
		support: {},
		verification: { kind: "unknown" },
		dependencies: { upstream: [], downstream: [] },
		provenance: { intents: "authored" },
		...over,
	};
}

function ctx(over: Partial<AvailabilityProbes> = {}): AvailabilityContext {
	return {
		provider: "claude-code",
		checkedAt: "2026-07-11T00:00:00.000Z",
		probes: {
			commandExists: () => true,
			containedFileExists: () => true,
			mcpServerConfigured: () => true,
			...over,
		},
	};
}

describe("computeAvailability", () => {
	it("external_binary: available when the command resolves, unavailable otherwise", () => {
		const e = cap("x", [{ type: "external_binary", id: "chromium", provenance: "authored" }]);
		expect(computeAvailability(e, ctx({ commandExists: () => true }))[0].status).toBe("available");
		expect(computeAvailability(e, ctx({ commandExists: () => false }))[0].status).toBe("unavailable");
	});

	it("skill_script / file_or_config: presence via containment check, never executed", () => {
		const e = cap("x", [{ type: "skill_script", id: "trace", provenance: "authored" }]);
		const snap = computeAvailability(e, ctx({ containedFileExists: () => true }))[0];
		expect(snap.status).toBe("available");
		expect(snap.evidence).toMatch(/not executed/);
	});

	it("mcp_or_app: available/unavailable from config, unknown when no config on disk", () => {
		const e = cap("x", [{ type: "mcp_or_app", id: "jira", provenance: "authored" }]);
		expect(computeAvailability(e, ctx({ mcpServerConfigured: () => true }))[0].status).toBe("available");
		expect(computeAvailability(e, ctx({ mcpServerConfigured: () => false }))[0].status).toBe("unavailable");
		expect(computeAvailability(e, ctx({ mcpServerConfigured: () => null }))[0].status).toBe("unknown");
	});

	it("host_tool / subagent_surface / lifecycle_event: honestly unknown (never inferred)", () => {
		for (const type of ["host_tool", "subagent_surface", "lifecycle_event"] as const) {
			const e = cap("x", [{ type, id: "t", provenance: "authored" }]);
			expect(computeAvailability(e, ctx())[0].status).toBe("unknown");
		}
	});

	it("stamps the injected checkedAt + provider (pure core reads no clock)", () => {
		const e = cap("x", [{ type: "external_binary", id: "git", provenance: "authored" }]);
		const snap = computeAvailability(e, ctx())[0];
		expect(snap.checkedAt).toBe("2026-07-11T00:00:00.000Z");
		expect(snap.provider).toBe("claude-code");
	});
});

describe("rollUpInvocability", () => {
	const s = (status: "available" | "unavailable" | "unknown") => ({ requirementType: "external_binary" as const, id: "x", status, evidence: "", checkedAt: "", provider: "p" });
	it("any unavailable ⇒ unavailable", () => expect(rollUpInvocability([s("available"), s("unavailable")])).toBe("unavailable"));
	it("all available ⇒ available", () => expect(rollUpInvocability([s("available"), s("available")])).toBe("available"));
	it("empty ⇒ unknown (host contract unproven)", () => expect(rollUpInvocability([])).toBe("unknown"));
	it("unknown present, none unavailable ⇒ unknown", () => expect(rollUpInvocability([s("available"), s("unknown")])).toBe("unknown"));
});

describe("resolveWithHost", () => {
	const entries = [
		cap("browser-tester", [{ type: "external_binary", id: "chromium", provenance: "authored" }], { intents: ["run a browser test"] }),
	];

	it("available requirement ⇒ status selected, candidate invocable available", () => {
		const r = resolveWithHost(entries, "run a browser test", ctx({ commandExists: () => true }));
		expect(r.status).toBe("selected");
		expect(r.candidates[0].invocable).toBe("available");
	});

	it("missing requirement ⇒ status unavailable (no stale success)", () => {
		const r = resolveWithHost(entries, "run a browser test", ctx({ commandExists: () => false }));
		expect(r.status).toBe("unavailable");
		expect(r.candidates[0].invocable).toBe("unavailable");
	});

	it("revocation between snapshots flips available → unavailable, never sticky", () => {
		const before = resolveWithHost(entries, "run a browser test", ctx({ commandExists: () => true }));
		const after = resolveWithHost(entries, "run a browser test", ctx({ commandExists: () => false }));
		expect(before.candidates[0].invocable).toBe("available");
		expect(after.candidates[0].invocable).toBe("unavailable");
	});

	it("provider that does not support the surface ⇒ status unsupported", () => {
		const unsupported = [
			cap("x", [], { intents: ["do the thing"], support: { codex: { discoverable: false, selectable: false, invocable: false, enforceable: false } } }),
		];
		const r = resolveWithHost(unsupported, "do the thing", { ...ctx(), provider: "codex" });
		expect(r.status).toBe("unsupported");
	});

	it("no match ⇒ status unavailable", () => {
		expect(resolveWithHost(entries, "xyzzy nonsense", ctx()).status).toBe("unavailable");
	});
});
