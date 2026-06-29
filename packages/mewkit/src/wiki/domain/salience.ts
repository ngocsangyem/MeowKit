// Salience rubric. Salience is an evaluated heuristic, NOT truth —
// it is an explicit, testable scoring function with named, bounded components.
// All weights and bounds live in one constant so they can be tuned in one place.

import type { SalienceComponents, SalienceScore } from "./types.js";

/** Inclusive [min, max] bound for every salience component. */
export const SALIENCE_BOUNDS: Record<keyof SalienceComponents, readonly [number, number]> = {
	explicit_user_intent: [0, 3],
	verified_outcome: [0, 3],
	recurrence_or_friction: [0, 2],
	novelty_vs_existing_wiki: [0, 2],
	future_reuse_likelihood: [0, 2],
	source_quality: [0, 2],
	blast_radius: [0, 2],
	security_risk_penalty: [-5, 0],
	staleness_penalty: [-3, 0],
};

const COMPONENT_KEYS = Object.keys(SALIENCE_BOUNDS) as (keyof SalienceComponents)[];

function clamp(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) {
		return min;
	}
	return Math.min(max, Math.max(min, value));
}

/**
 * Score a set of salience components. Each component is clamped to its declared
 * bound before summing, so `total` is always within the rubric's range
 * (max +16 from the seven positive components, min −8 from the two penalties).
 * The returned `components` are the clamped values actually used.
 */
export function scoreSalience(input: SalienceComponents): SalienceScore {
	const components = {} as SalienceComponents;
	let total = 0;
	for (const key of COMPONENT_KEYS) {
		const [min, max] = SALIENCE_BOUNDS[key];
		const clamped = clamp(input[key], min, max);
		components[key] = clamped;
		total += clamped;
	}
	return { total, components };
}
