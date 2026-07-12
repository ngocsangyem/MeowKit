// Phase 6 slice 2: per-provider invocation shapes. The security seam — provider-native operation
// strings live ONLY in this adapter table; the capability manifest stays logical-id-only. Every
// provider map covers exactly the known logical invocation ids (no gaps, no smuggled extras).
import { describe, expect, it } from "vitest";
import { getInvocationShapes, getInvocationShape } from "../provider-invocation.js";
import { KNOWN_INVOCATION_IDS } from "../capability.js";

describe("getInvocationShapes", () => {
	it("claude-code: typed ops for skill/agent/command + hook; workflow advisory; none unsupported", () => {
		const m = getInvocationShapes("claude-code");
		expect(m["invoke-skill"].support).toBe("supported");
		expect(m["invoke-agent"].support).toBe("supported");
		expect(m["invoke-command"].support).toBe("supported");
		expect(m["lifecycle-hook"].support).toBe("supported");
		expect(m["invoke-workflow"].support).toBe("advisory"); // no distinct workflow primitive
		expect(m.none.support).toBe("unsupported");
	});

	it("codex: prompt/instruction-projected ⇒ advisory (not typed invoke); none unsupported", () => {
		const m = getInvocationShapes("codex");
		for (const id of ["invoke-skill", "invoke-agent", "invoke-command", "invoke-workflow", "lifecycle-hook"]) {
			expect(m[id].support, id).toBe("advisory");
		}
		expect(m.none.support).toBe("unsupported");
	});

	it("unknown provider: every invocation id unknown (claims nothing)", () => {
		const m = getInvocationShapes("some-future-runtime");
		for (const id of KNOWN_INVOCATION_IDS) expect(m[id].support, id).toBe("unknown");
	});

	it("every provider map covers EXACTLY the known logical invocation ids (no gaps, no extras)", () => {
		for (const provider of ["claude-code", "claude-plugin", "codex", "some-future-runtime"]) {
			expect(new Set(Object.keys(getInvocationShapes(provider)))).toEqual(new Set(KNOWN_INVOCATION_IDS));
		}
	});

	it("getInvocationShape falls back to unknown for an unrecognized id", () => {
		expect(getInvocationShape("claude-code", "invoke-nonsense").support).toBe("unknown");
	});
});
