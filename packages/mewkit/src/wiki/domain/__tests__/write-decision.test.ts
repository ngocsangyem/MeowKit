import { describe, expect, it } from "vitest";
import { scoreSalience } from "../salience.js";
import { decideWrite } from "../write-decision.js";
import { makeWikiPageId } from "../types.js";
import type { DupCheck, InjectionVerdict, SalienceComponents } from "../types.js";

const CLEAN: InjectionVerdict = { status: "clean", passes: 2, findings: [] };
const NO_DUP: DupCheck = { isHighDuplicate: false };

const ZERO: SalienceComponents = {
	explicit_user_intent: 0,
	verified_outcome: 0,
	recurrence_or_friction: 0,
	novelty_vs_existing_wiki: 0,
	future_reuse_likelihood: 0,
	source_quality: 0,
	blast_radius: 0,
	security_risk_penalty: 0,
	staleness_penalty: 0,
};

/** Build a score whose total lands on `target` with an optional verified signal. */
function scoreAt(target: number, verified = false): ReturnType<typeof scoreSalience> {
	const components: SalienceComponents = { ...ZERO };
	let remaining = target;
	if (verified) {
		components.verified_outcome = 3;
		remaining -= 3;
	}
	// Distribute the remainder across positive components (each capped at its bound).
	const fillers: (keyof SalienceComponents)[] = [
		"explicit_user_intent",
		"recurrence_or_friction",
		"novelty_vs_existing_wiki",
		"future_reuse_likelihood",
		"source_quality",
		"blast_radius",
	];
	const caps: Record<string, number> = {
		explicit_user_intent: 3,
		recurrence_or_friction: 2,
		novelty_vs_existing_wiki: 2,
		future_reuse_likelihood: 2,
		source_quality: 2,
		blast_radius: 2,
	};
	for (const key of fillers) {
		if (remaining <= 0) break;
		const take = Math.min(caps[key], remaining);
		components[key] = take;
		remaining -= take;
	}
	const score = scoreSalience(components);
	if (score.total !== target) {
		throw new Error(`could not build score for target ${target} (got ${score.total})`);
	}
	return score;
}

describe("decideWrite — security precedence", () => {
	it("quarantines on an injection verdict regardless of high salience", () => {
		const verdict: InjectionVerdict = { status: "injection", passes: 2, findings: ["x"] };
		const decision = decideWrite(scoreAt(12, true), verdict, NO_DUP);
		expect(decision.kind).toBe("quarantine");
	});

	it("quarantines on a secret verdict", () => {
		const verdict: InjectionVerdict = { status: "secret", passes: 2, findings: ["AKIA…"] };
		expect(decideWrite(scoreAt(12, true), verdict, NO_DUP).kind).toBe("quarantine");
	});

	it("quarantines a clean verdict with too few scan passes", () => {
		const underScanned: InjectionVerdict = { status: "clean", passes: 1, findings: [] };
		const decision = decideWrite(scoreAt(12, true), underScanned, NO_DUP);
		expect(decision.kind).toBe("quarantine");
		if (decision.kind === "quarantine") {
			expect(decision.reason).toMatch(/incomplete/);
		}
	});

	it("quarantines a clean verdict with zero scan passes", () => {
		const unscanned: InjectionVerdict = { status: "clean", passes: 0, findings: [] };
		expect(decideWrite(scoreAt(8), unscanned, NO_DUP).kind).toBe("quarantine");
	});
});

describe("decideWrite — duplication", () => {
	it("links to the existing page on high duplication", () => {
		const dup: DupCheck = { isHighDuplicate: true, existingPageId: makeWikiPageId("page-9") };
		const decision = decideWrite(scoreAt(12, true), CLEAN, dup);
		expect(decision.kind).toBe("link-existing");
		if (decision.kind === "link-existing") {
			expect(decision.existingPageId).toBe("page-9");
		}
	});

	it("does not link when the duplicate page id is absent", () => {
		const dup: DupCheck = { isHighDuplicate: true };
		expect(decideWrite(scoreAt(9), CLEAN, dup).kind).toBe("propose-candidate");
	});
});

describe("decideWrite — salience thresholds", () => {
	it("appends to candidates.jsonl at >=10 with a verified signal", () => {
		expect(decideWrite(scoreAt(10, true), CLEAN, NO_DUP).kind).toBe("append-candidate");
	});

	it("only proposes (not appends) at >=10 without a verified signal", () => {
		expect(decideWrite(scoreAt(10, false), CLEAN, NO_DUP).kind).toBe("propose-candidate");
	});

	it("proposes a candidate exactly at the threshold of 8", () => {
		expect(decideWrite(scoreAt(8), CLEAN, NO_DUP).kind).toBe("propose-candidate");
	});

	it("discards just below the threshold at 7", () => {
		expect(decideWrite(scoreAt(7), CLEAN, NO_DUP).kind).toBe("discard");
	});

	it("never returns a canonical page-write decision", () => {
		const kinds = [
			decideWrite(scoreAt(12, true), CLEAN, NO_DUP).kind,
			decideWrite(scoreAt(8), CLEAN, NO_DUP).kind,
			decideWrite(scoreAt(0), CLEAN, NO_DUP).kind,
		];
		expect(kinds).not.toContain("page");
		expect(kinds).not.toContain("commit");
	});
});
