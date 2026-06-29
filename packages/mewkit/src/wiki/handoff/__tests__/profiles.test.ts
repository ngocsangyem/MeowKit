import { describe, expect, it } from "vitest";
import { scoreSalience } from "../../domain/index.js";
import type { ArtifactSignal } from "../domain.js";
import { isRegistered, listProfiles, lookupProfile, NONE_PROFILE } from "../profiles.js";

function signal(overrides: Partial<ArtifactSignal> = {}): ArtifactSignal {
	return {
		skillName: "mk:cook",
		artifactPath: "tasks/reports/x.md",
		artifactHash: "b".repeat(64),
		contentBytes: 800,
		producedAt: "2026-06-29T00:00:00.000Z",
		...overrides,
	};
}

describe("lookupProfile", () => {
	it("resolves a class-A skill to its required profile", () => {
		const p = lookupProfile("mk:cook");
		expect(p.handoffClass).toBe("required");
		expect(p.profile).toBe("lifecycle-run");
	});

	it("a class-A skill's defaultSalience clears the propose threshold", () => {
		const p = lookupProfile("mk:cook");
		const total = scoreSalience(p.defaultSalience(signal({ verifiedOutcome: true }))).total;
		expect(total).toBeGreaterThanOrEqual(8);
	});

	it("a class-C (unregistered) skill never suggests", () => {
		const p = lookupProfile("mk:simplify");
		expect(p.handoffClass).toBe("none");
		expect(p.shouldSuggest(signal({ verifiedOutcome: true, explicitUserIntent: true }))).toBe(false);
	});

	it("an entirely unknown skill falls back to the none default carrying its name", () => {
		const p = lookupProfile("totally-unknown-skill");
		expect(p.handoffClass).toBe("none");
		expect(p.skillName).toBe("totally-unknown-skill");
		expect(p.shouldSuggest(signal())).toBe(false);
	});

	it("a conditional (class-B) skill suggests only on a project-specific signal", () => {
		const p = lookupProfile("mk:database");
		expect(p.handoffClass).toBe("conditional");
		expect(p.shouldSuggest(signal())).toBe(false);
		expect(p.shouldSuggest(signal({ verifiedOutcome: true }))).toBe(true);
	});
});

describe("listProfiles", () => {
	const all = listProfiles();

	it("registers both required and conditional classes", () => {
		const classes = new Set(all.map((p) => p.handoffClass));
		expect(classes.has("required")).toBe(true);
		expect(classes.has("conditional")).toBe(true);
		expect(classes.has("none")).toBe(false); // none is the default, never registered
	});

	it("has no duplicate skill names", () => {
		const names = all.map((p) => p.skillName);
		expect(new Set(names).size).toBe(names.length);
	});

	it("every entry carries a concrete (non-none) profile tag", () => {
		expect(all.every((p) => p.profile !== "none")).toBe(true);
	});

	it("is sorted by skill name", () => {
		const names = all.map((p) => p.skillName);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});
});

describe("registration helpers", () => {
	it("isRegistered reflects the registry", () => {
		expect(isRegistered("mk:cook")).toBe(true);
		expect(isRegistered("mk:simplify")).toBe(false);
	});

	it("the none default is class none with an empty profile", () => {
		expect(NONE_PROFILE.handoffClass).toBe("none");
		expect(NONE_PROFILE.profile).toBe("none");
	});
});
