import { describe, expect, it } from "vitest";
import { SALIENCE_BOUNDS, scoreSalience } from "../salience.js";
import type { SalienceComponents } from "../types.js";

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

describe("scoreSalience", () => {
	it("sums an all-zero set to zero", () => {
		expect(scoreSalience(ZERO).total).toBe(0);
	});

	it("sums the maximum positive components to 16", () => {
		const max: SalienceComponents = {
			explicit_user_intent: 3,
			verified_outcome: 3,
			recurrence_or_friction: 2,
			novelty_vs_existing_wiki: 2,
			future_reuse_likelihood: 2,
			source_quality: 2,
			blast_radius: 2,
			security_risk_penalty: 0,
			staleness_penalty: 0,
		};
		expect(scoreSalience(max).total).toBe(16);
	});

	it("applies the maximum penalties to reach -8", () => {
		const penalised: SalienceComponents = {
			...ZERO,
			security_risk_penalty: -5,
			staleness_penalty: -3,
		};
		expect(scoreSalience(penalised).total).toBe(-8);
	});

	it("clamps a component above its bound", () => {
		const result = scoreSalience({ ...ZERO, explicit_user_intent: 99 });
		expect(result.components.explicit_user_intent).toBe(3);
		expect(result.total).toBe(3);
	});

	it("clamps a positive component below zero", () => {
		const result = scoreSalience({ ...ZERO, source_quality: -10 });
		expect(result.components.source_quality).toBe(0);
		expect(result.total).toBe(0);
	});

	it("clamps a penalty that is too negative to its floor", () => {
		const result = scoreSalience({ ...ZERO, security_risk_penalty: -99 });
		expect(result.components.security_risk_penalty).toBe(-5);
		expect(result.total).toBe(-5);
	});

	it("clamps a penalty pushed positive back to zero", () => {
		const result = scoreSalience({ ...ZERO, staleness_penalty: 4 });
		expect(result.components.staleness_penalty).toBe(0);
	});

	it("treats NaN as the component minimum", () => {
		const result = scoreSalience({ ...ZERO, verified_outcome: Number.NaN });
		expect(result.components.verified_outcome).toBe(0);
	});

	it("exposes a bound for every component", () => {
		for (const key of Object.keys(ZERO) as (keyof SalienceComponents)[]) {
			expect(SALIENCE_BOUNDS[key]).toBeDefined();
		}
	});
});
