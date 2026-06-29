import { describe, expect, it } from "vitest";
import { WikiService, type ProposeInput } from "../service.js";
import { searchWiki } from "../queries.js";
import { makeWikiSlug, scoreSalience } from "../../domain/index.js";
import type { SalienceComponents, WikiCandidate } from "../../domain/index.js";
import { CLEAN_SCAN, INJECTION_SCAN, makeMocks } from "./mocks.js";

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

const input: ProposeInput = {
	slug: SLUG,
	title: "Intro",
	content: "raw body",
	origin: "agent",
	whySave: "x",
	evidence: "y",
	sourceIds: [],
	salience: HIGH,
};

function candidate(): WikiCandidate {
	return {
		id: "demo/cand-1",
		slug: SLUG,
		origin: "agent",
		title: "Intro",
		content: "clean scrubbed body",
		whySave: "x",
		evidence: "y",
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

describe("approveCandidate is the sole canonical mint", () => {
	it("agent proposal never writes; only human approval does", () => {
		const m = makeMocks(CLEAN_SCAN);
		const svc = new WikiService(m.deps);
		svc.proposeCandidate(input);
		expect(m.calls).not.toContain("writePage");
		m.candidates.push(candidate());
		svc.approveCandidate(SLUG, "demo/cand-1", "alice");
		expect(m.calls).toContain("writePage");
	});

	it("rejectCandidate records an intervention + trace, never a page", () => {
		const m = makeMocks(CLEAN_SCAN);
		new WikiService(m.deps).rejectCandidate(SLUG, "demo/cand-1", "low value");
		expect(m.calls).toEqual(["appendIntervention", "trace:wiki_reject"]);
		expect(m.calls).not.toContain("writePage");
	});
});

describe("scanner is unconditional", () => {
	it("an injected proposal is quarantined — no candidate, no page", () => {
		const m = makeMocks(INJECTION_SCAN);
		const svc = new WikiService(m.deps);
		const result = svc.proposeCandidate(input);
		expect(result.decision.kind).toBe("quarantine");
		expect(m.calls).toContain("quarantine");
		expect(m.calls).toContain("appendIntervention");
		expect(m.calls).toContain("trace:wiki_quarantine");
		expect(m.calls).not.toContain("appendCandidate");
		expect(m.calls).not.toContain("writePage");
	});

	it("human approval CANNOT bypass the scanner — a re-scan failure blocks the write", () => {
		const m = makeMocks(INJECTION_SCAN);
		m.candidates.push(candidate());
		const svc = new WikiService(m.deps);
		expect(() => svc.approveCandidate(SLUG, "demo/cand-1", "alice")).toThrow(/re-scan/);
		expect(m.calls).toContain("quarantine");
		expect(m.calls).not.toContain("writePage");
	});

	it("approveCandidate throws on an unknown candidate", () => {
		const m = makeMocks(CLEAN_SCAN);
		expect(() => new WikiService(m.deps).approveCandidate(SLUG, "nope", "alice")).toThrow(/not found/);
	});
});

describe("query side is side-effect-free", () => {
	it("searchWiki touches only the read path", () => {
		const m = makeMocks(CLEAN_SCAN);
		const hits = searchWiki(m.deps.index, "salience");
		expect(hits).toEqual([]);
		expect(m.calls).toEqual(["searchFts"]);
	});

	it("enqueueSeed appends a seed + trace (command side)", () => {
		const m = makeMocks(CLEAN_SCAN);
		new WikiService(m.deps).enqueueSeed(SLUG, { id: "s1", query: "q", kind: "web", status: "queued", createdAt: "t" });
		expect(m.calls).toEqual(["appendSeed", "trace:wiki_seed"]);
	});
});
