// Phase 2 slice 2: deterministic resolver. Flagship intents resolve to the right
// capability with a reason; ambiguity and no-match are explicit; nothing is marked
// runtime-invocable (that is Phase 3's host snapshot).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../resolve-capabilities.js";
import { buildCapabilities } from "../build-capabilities.js";
import { AUTHORED_INTENTS } from "../capability-authored.js";
import type { CapabilityEntry } from "../capability.js";

function cap(id: string, intents: string[], aliases: string[] = []): CapabilityEntry {
	return {
		id,
		kind: "skill",
		description: "",
		aliases,
		sourcePath: `skills/${id}/SKILL.md`,
		inventoryId: id,
		owner: "lifecycle",
		installedState: "installed",
		intents,
		whenToUse: null,
		invocation: { kind: "skill", id: "invoke-skill" },
		requirements: [],
		support: { "claude-code": { discoverable: true, selectable: true, invocable: true, enforceable: false } },
		verification: { kind: "unknown" },
		dependencies: { upstream: [], downstream: [] },
		provenance: {},
	};
}

const flagship: CapabilityEntry[] = [
	cap("mk:plan-creator", ["plan this feature", "create a plan", "draft a spec"], ["plan"]),
	cap("mk:cook", ["implement this feature", "build this", "write the code"], ["cook", "implement"]),
	cap("mk:review", ["review this code", "code review", "check before shipping"], ["review"]),
	cap("mk:scout", ["scout the codebase", "find related files"], ["scout"]),
];

describe("resolveCapabilities", () => {
	it("resolves a flagship intent to the right capability as the top candidate", () => {
		const r = resolveCapabilities(flagship, "create a plan for this feature");
		expect(r.candidates[0]?.id).toBe("mk:plan-creator");
		expect(r.candidates[0]?.reason).toMatch(/intent term/);
		expect(r.ambiguous).toBe(false);
	});

	it("never marks a candidate runtime-invocable (defers to host snapshot)", () => {
		const r = resolveCapabilities(flagship, "review this code");
		expect(r.candidates[0]?.id).toBe("mk:review");
		expect(r.candidates.every((c) => c.invocable === "pending-host-snapshot")).toBe(true);
	});

	it("returns ambiguous with no candidates when nothing matches", () => {
		const r = resolveCapabilities(flagship, "xyzzy quux nonsense");
		expect(r.candidates).toEqual([]);
		expect(r.ambiguous).toBe(true);
	});

	it("flags ambiguity when the top two are within the near-tie threshold", () => {
		// Two capabilities each matching exactly one intent term equally.
		const tie = [cap("a", ["deploy the app"]), cap("b", ["deploy the service"])];
		const r = resolveCapabilities(tie, "deploy");
		expect(r.ambiguous).toBe(true);
		expect(r.candidates.length).toBe(2);
	});

	it("an authored flagship intent outranks a keyword-heavy inferred capability sharing a term", () => {
		// C1 regression: keyword multiplicity must not out-sum a curated flagship phrase.
		const authoredCook = { ...cap("mk:cook", ["build this"]), provenance: { intents: "authored" as const } };
		const keywordHeavy = cap("mk:build-fix", ["build-fix", "build-failed", "build-error"]); // inferred (provenance {})
		const r = resolveCapabilities([keywordHeavy, authoredCook], "build this");
		expect(r.candidates[0]?.id).toBe("mk:cook");
		expect(r.ambiguous).toBe(false); // authored (6) vs inferred (3) is a confident win
	});

	it("is deterministic: equal scores tie-break by id ascending", () => {
		const tie = [cap("zeta", ["ship it"]), cap("alpha", ["ship it"])];
		const r = resolveCapabilities(tie, "ship it");
		expect(r.candidates.map((c) => c.id)).toEqual(["alpha", "zeta"]);
	});

	it("attaches per-provider support when a provider is given", () => {
		const r = resolveCapabilities(flagship, "scout the codebase", "claude-code");
		expect(r.candidates[0]?.support?.discoverable).toBe(true);
		const none = resolveCapabilities(flagship, "scout the codebase", "codex");
		expect(none.candidates[0]?.support).toBeNull();
	});

	it("describe-only tool entries (jira/browser) carry no intents and do not win user intents", () => {
		const caps = buildCapabilities(join(process.cwd(), ".claude"));
		const jira = caps.find((c) => c.id === "jira" && c.kind === "tool");
		expect(jira?.intents).toEqual([]);
		// A jira user intent must not resolve to the non-invocable tool entry as top-1.
		const top = resolveCapabilities(caps, "create a jira issue").candidates[0];
		expect(top?.id).not.toBe("jira");
	});

	it("resolves EVERY authored flagship phrase to its owner as top-1 on the LIVE harness", () => {
		const caps = buildCapabilities(join(process.cwd(), ".claude"));
		// Guard: overlay actually applied (real .claude present, not an empty subdir).
		expect(caps.find((c) => c.id === "mk:cook")?.provenance.intents).toBe("authored");
		// The C1 regression guard: every curated phrase must resolve to its owning capability
		// as the top candidate, even against 200+ competing inferred-keyword capabilities.
		for (const [ownerId, { intents }] of Object.entries(AUTHORED_INTENTS)) {
			for (const phrase of intents) {
				const top = resolveCapabilities(caps, phrase).candidates[0];
				expect(top?.id, `"${phrase}" should resolve to ${ownerId}, got ${top?.id}`).toBe(ownerId);
			}
		}
	});
});
