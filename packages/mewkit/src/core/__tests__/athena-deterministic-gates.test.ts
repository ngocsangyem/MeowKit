// The deterministic half of the supervisor's validation lane.
//
// Two jobs, and they are different in kind:
//
//  1. The per-provider support report — the surface an operator actually reads before
//     trusting `--advice` on a runtime. Its invariant is that structural evidence can never
//     produce a `supported` claim, on any provider, ever.
//
//  2. A coverage oracle over the declared gate groups. Each group names the file that owns
//     its assertions and a title substring that must exist there. This does NOT prove the
//     assertions are correct — nothing here re-checks them. It proves a whole area cannot
//     be deleted or renamed away silently, which is the failure a passing suite hides best:
//     a green run over tests that no longer exist looks identical to a green run over tests
//     that do.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	ADVICE_CAPABILITY_ID,
	ADVICE_SUPPORT_STATES,
	readAdviceSupport,
} from "../advice-support-report.js";
import { AUTHORED_CAPABILITIES } from "../capability-authored.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const read = (p: string): string => readFileSync(p, "utf-8");

describe("advice support report: every provider states both capabilities", () => {
	for (const provider of ["claude-code", "codex", "cursor"]) {
		it(`${provider}: reports embedded supervision and direct consult separately`, () => {
			const report = readAdviceSupport(provider);
			expect(report, `${provider} has no advice report`).not.toBeNull();
			const names = (report as NonNullable<typeof report>).capabilities.map((c) => c.capability).sort();
			expect(names).toEqual(["direct-consult", "embedded-supervision"]);
		});

		it(`${provider}: no capability claims support on structural evidence`, () => {
			const report = readAdviceSupport(provider);
			for (const cap of (report as NonNullable<typeof report>).capabilities) {
				expect(ADVICE_SUPPORT_STATES, `${cap.capability} state`).toContain(cap.state);
				if (cap.evidence === "structural") {
					expect(cap.state, `${provider}/${cap.capability} claims support without a live run`).not.toBe(
						"supported",
					);
				}
			}
		});
	}

	it("an unknown provider reports unverified rather than nothing", () => {
		// Silence would read as "fine". A runtime nobody has exercised must say so.
		const report = readAdviceSupport("some-runtime-that-does-not-exist");
		expect(report).not.toBeNull();
		expect((report as NonNullable<typeof report>).source).toBe("capability-registry");
		for (const cap of (report as NonNullable<typeof report>).capabilities) {
			expect(cap.state).toBe("unverified");
		}
	});

	it("the codex mutation ban is reported behavioral, the cursor one structural", () => {
		// Codex has no per-agent tool field. Reporting its ban as structural would claim an
		// enforcement the runtime cannot provide.
		expect(readAdviceSupport("codex")?.mutationBan?.enforcement).toBe("behavioral");
		expect(readAdviceSupport("cursor")?.mutationBan?.enforcement).toBe("structural");
	});

	it("the capability registry still records no proven provider support", () => {
		// The registry's `support` map is populated from recorded smoke evidence only. A
		// non-empty map here means someone claimed a live result; that claim needs a dated
		// record in the live lane, not a code edit.
		const entry = AUTHORED_CAPABILITIES.find((c) => c.id === ADVICE_CAPABILITY_ID);
		expect(entry, "advice-supervision missing from the registry").toBeTruthy();
		expect(Object.keys(entry?.support ?? {})).toEqual([]);
	});
});

describe("deterministic gate coverage: every declared group has an owning suite", () => {
	// group → [file, a title substring that must appear in it]
	const GROUPS: Record<string, [string, string]> = {
		"1 protocol schema": ["athena-supervision-contract.test.ts", "stage and disposition legality"],
		"2 activation": ["athena-extended-cohort.test.ts", "skills that must never become supervision entry points"],
		"3 cadence and idempotency": ["athena-supervision-contract.test.ts", "cadence, caps and idempotency"],
		"4 context budget": ["athena-supervision-contract.test.ts", "input packet validation"],
		"5 correction cycle": ["athena-supervision-wiring.test.ts", "evidence revision and supersession"],
		"6 authority": ["athena-provider-parity.test.ts", "no plane claims gate authority"],
		"7 handoff and propagation": ["athena-extended-cohort.test.ts", "the orchestrator forwards a run id"],
		"8 html matrix": ["athena-html-orthogonality.test.ts", "the flags are parsed independently"],
		"9 provider packaging": ["athena-provider-parity.test.ts", "declared support states are honest"],
		"10 fallback": ["athena-provider-parity.test.ts", "keeps the fallback line"],
		"11 state failure": ["athena-supervision-wiring.test.ts", "corrupt dossier"],
		"12 strategic role": ["athena-direct-consult.test.ts", "the two modes cannot impersonate each other"],
	};

	for (const [group, [file, title]] of Object.entries(GROUPS)) {
		it(`${group}: covered by ${file}`, () => {
			const path = join(testsDir, file);
			expect(existsSync(path), `${file} is gone — group "${group}" lost its owner`).toBe(true);
			expect(read(path), `${file} no longer contains "${title}"`).toContain(title);
		});
	}

	it("the live lane is not counted as deterministic coverage", () => {
		// Every group above is a structural or model-free assertion. Delegation, foreground
		// wait, and the mutation-refusal probe cannot be proven here at all — they need an
		// authenticated runtime — so no group claims them, and the support states stay
		// `unverified` until a recorded run says otherwise.
		for (const provider of ["claude-code", "codex", "cursor"]) {
			for (const cap of readAdviceSupport(provider)?.capabilities ?? []) {
				expect(cap.evidence, `${provider}/${cap.capability} claims live evidence`).toBe("structural");
			}
		}
	});
});
