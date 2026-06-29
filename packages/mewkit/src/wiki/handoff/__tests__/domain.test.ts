import { describe, expect, it } from "vitest";
import { makeWikiSlug, scoreSalience } from "../../domain/index.js";
import type { ProposeInput } from "../../application/ports.js";
import { defaultShouldSuggest, makeSkillProfile, salienceComponents } from "../profile-factory.js";
import { toProposeInput, type ArtifactSignal, type WikiHandoffPacket } from "../domain.js";

const SLUG = makeWikiSlug("handoff-test");

function signal(overrides: Partial<ArtifactSignal> = {}): ArtifactSignal {
	return {
		skillName: "mk:cook",
		artifactPath: "tasks/reports/x.md",
		artifactHash: "a".repeat(64),
		contentBytes: 1200,
		producedAt: "2026-06-29T00:00:00.000Z",
		...overrides,
	};
}

function packet(overrides: Partial<WikiHandoffPacket> = {}): WikiHandoffPacket {
	return {
		slug: SLUG,
		skillName: "mk:cook",
		handoffClass: "required",
		profile: "lifecycle-run",
		artifactPath: "tasks/reports/x.md",
		artifactHash: "a".repeat(64),
		title: "Run report",
		content: "body",
		origin: "agent",
		whySave: "captures a non-obvious decision",
		evidence: "tasks/reviews/x-verdict.md",
		sourceIds: ["src-1"],
		reuseScope: "lifecycle",
		verificationState: "verified",
		riskScore: 0,
		noveltyDelta: 1,
		salience: salienceComponents({ verified_outcome: 3, source_quality: 2, future_reuse_likelihood: 2, blast_radius: 1 }),
		createdAt: "2026-06-29T00:00:00.000Z",
		...overrides,
	};
}

describe("salienceComponents", () => {
	it("zero-fills every component", () => {
		const c = salienceComponents();
		expect(Object.values(c).every((v) => v === 0)).toBe(true);
	});

	it("applies overrides without dropping other keys", () => {
		const c = salienceComponents({ verified_outcome: 3 });
		expect(c.verified_outcome).toBe(3);
		expect(c.source_quality).toBe(0);
		expect(Object.keys(c)).toHaveLength(9);
	});
});

describe("toProposeInput", () => {
	it("produces a value assignable to ProposeInput (compile + runtime)", () => {
		const result: ProposeInput = toProposeInput(packet());
		expect(result.slug).toBe(SLUG);
		expect(result.origin).toBe("agent");
		expect(result.title).toBe("Run report");
		expect(result.content).toBe("body");
		expect(result.sourceIds).toEqual(["src-1"]);
		expect(result.reuseScope).toBe("lifecycle");
		expect(result.verificationState).toBe("verified");
		expect(result.noveltyDelta).toBe(1);
	});

	it("carries every mapped salience component through unchanged", () => {
		const p = packet();
		const result = toProposeInput(p);
		expect(result.salience).toEqual(p.salience);
	});

	it("drops provenance-only fields (skill/profile/artifact are not on ProposeInput)", () => {
		const result = toProposeInput(packet());
		expect("skillName" in result).toBe(false);
		expect("profile" in result).toBe(false);
		expect("artifactHash" in result).toBe(false);
	});
});

describe("makeSkillProfile.defaultSalience", () => {
	const profile = makeSkillProfile({
		skillName: "mk:demo",
		handoffClass: "required",
		profile: "lifecycle-run",
		defaultReuseScope: "lifecycle",
		artifactPatterns: [],
		salienceBase: { source_quality: 2, future_reuse_likelihood: 2, blast_radius: 1 },
	});

	it("raises verified_outcome to 3 on a verified-outcome signal", () => {
		expect(profile.defaultSalience(signal({ verifiedOutcome: true })).verified_outcome).toBe(3);
	});

	it("raises explicit_user_intent to 3 on an explicit-intent signal", () => {
		expect(profile.defaultSalience(signal({ explicitUserIntent: true })).explicit_user_intent).toBe(3);
	});

	it("honors a caller-supplied novelty override and security penalty", () => {
		const c = profile.defaultSalience(signal({ noveltyDelta: 2, securityRiskPenalty: -2 }));
		expect(c.novelty_vs_existing_wiki).toBe(2);
		expect(c.security_risk_penalty).toBe(-2);
	});
});

describe("defaultShouldSuggest", () => {
	it("never suggests for class none", () => {
		expect(defaultShouldSuggest("none", signal({ verifiedOutcome: true }))).toBe(false);
	});

	it("never suggests for an empty artifact", () => {
		expect(defaultShouldSuggest("required", signal({ contentBytes: 0 }))).toBe(false);
	});

	it("always suggests for a substantive required artifact", () => {
		expect(defaultShouldSuggest("required", signal())).toBe(true);
	});

	it("suggests conditionally only on a project-specific signal", () => {
		expect(defaultShouldSuggest("conditional", signal())).toBe(false);
		expect(defaultShouldSuggest("conditional", signal({ verifiedOutcome: true }))).toBe(true);
	});
});

describe("scoreSalience round-trip with profile defaults", () => {
	it("scores a class-A representative signal at or above the propose threshold", () => {
		const profile = makeSkillProfile({
			skillName: "mk:cook",
			handoffClass: "required",
			profile: "lifecycle-run",
			defaultReuseScope: "lifecycle",
			artifactPatterns: [],
			salienceBase: { verified_outcome: 2, source_quality: 2, future_reuse_likelihood: 2, blast_radius: 1 },
		});
		const total = scoreSalience(profile.defaultSalience(signal({ verifiedOutcome: true }))).total;
		expect(total).toBeGreaterThanOrEqual(8);
	});
});
