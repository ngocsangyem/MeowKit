import { describe, expect, it } from "vitest";
import { WikiService, type ProposeInput } from "../service.js";
import { scoreSalience } from "../../domain/index.js";
import { makeWikiSlug } from "../../domain/index.js";
import type { SalienceComponents, WikiCandidate } from "../../domain/index.js";
import { CLEAN_SCAN, makeMocks } from "./mocks.js";

const SLUG = makeWikiSlug("demo");
const HIGH: SalienceComponents = {
	explicit_user_intent: 3,
	verified_outcome: 3,
	recurrence_or_friction: 2,
	novelty_vs_existing_wiki: 0,
	future_reuse_likelihood: 0,
	source_quality: 0,
	blast_radius: 0,
	security_risk_penalty: 0,
	staleness_penalty: 0,
};

function proposeInput(overrides: Partial<ProposeInput> = {}): ProposeInput {
	return {
		slug: SLUG,
		title: "Salience Rubric",
		content: "raw body",
		origin: "agent",
		whySave: "useful",
		evidence: "passed tests",
		sourceIds: [],
		salience: HIGH,
		...overrides,
	};
}

function candidateFixture(): WikiCandidate {
	return {
		id: "demo/cand-1",
		slug: SLUG,
		origin: "agent",
		title: "Salience Rubric",
		content: "clean scrubbed body",
		whySave: "useful",
		evidence: "passed tests",
		sourceIds: [],
		noveltyDelta: 0,
		reuseScope: "",
		verificationState: "unverified",
		riskScore: 0,
		salience: scoreSalience(HIGH),
		state: "proposed",
		createdAt: "2026-06-29T00:00:00.000Z",
	};
}

describe("write-transaction order", () => {
	it("proposeCandidate scans, persists a candidate, traces — and NEVER writes a page", () => {
		const m = makeMocks(CLEAN_SCAN);
		const svc = new WikiService(m.deps);
		const result = svc.proposeCandidate(proposeInput());
		expect(result.candidate).toBeDefined();
		expect(m.calls).toEqual(["scan", "appendCandidate", "trace:wiki_candidate"]);
		expect(m.calls).not.toContain("writePage");
	});

	it("the persisted candidate carries SCRUBBED content, not the raw input", () => {
		const m = makeMocks(CLEAN_SCAN);
		new WikiService(m.deps).proposeCandidate(proposeInput({ content: "raw with secret" }));
		expect(m.candidates[0]!.content).toBe("clean scrubbed body");
	});

	it("approveCandidate re-scans, then writes → indexes → traces in that order", () => {
		const m = makeMocks(CLEAN_SCAN);
		m.candidates.push(candidateFixture());
		const svc = new WikiService(m.deps);
		const page = svc.approveCandidate(SLUG, "demo/cand-1", "alice");
		expect(page.provenance.origin).toBe("human");
		expect(page.provenance.approvedBy).toBe("alice");
		// scrub+scan precede the canonical write; write precedes index precedes trace.
		expect(m.calls).toEqual(["scan", "writePage", "upsertPage", "trace:wiki_write"]);
		const w = m.calls.indexOf("writePage");
		expect(m.calls.indexOf("scan")).toBeLessThan(w);
		expect(w).toBeLessThan(m.calls.indexOf("upsertPage"));
		expect(m.calls.indexOf("upsertPage")).toBeLessThan(m.calls.indexOf("trace:wiki_write"));
	});
});
