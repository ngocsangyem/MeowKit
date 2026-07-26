// Cross-provider parity for the Athena supervisor contract.
//
// Three planes carry the same semantics through three different runtime dialects:
// Claude (`.claude/agents/athena.md` + the conditional rule), Codex (an authored
// `.codex/agents/athena.toml` + a `rule-` skill projection, because Codex has no
// conditional-rule surface), and Cursor (an authored `.cursor/agents/athena.md` + an
// Agent-Requested `.mdc`).
//
// The parity that matters is SEMANTIC, not byte-level: each adapter is hand-authored in
// its own runtime's vocabulary, so a diff would be meaningless. What must never drift is
// the contract the code enforces — the four stages, the stage→disposition legality, the
// per-skill caps, and the strategy brief's required and refused field sets. Those are
// asserted against the exported constants rather than against a second copy of the prose,
// so changing a cap in code and forgetting a plane fails here.
//
// Structural safety is asserted per plane and NOT equalized: Cursor gets `readonly: true`,
// Claude gets read-only tools, and Codex — which has no per-agent tool field — must
// DISCLOSE that its ban is behavioral rather than claim parity it does not have.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_BRIEF_FIELDS } from "../athena-strategy-brief.js";
import { SKILL_HARD_CAPS, SUPERVISION_STAGES, legalDispositions } from "../athena-supervision-protocol.js";
import { scanForGateAuthority } from "../check-gate-authority.js";
import { scanDeniedTokens } from "../../migrate/denied-token-scan.js";
import { scanCursorDenied } from "../../migrate/modules/cursor-extra-denied-tokens.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const modulesDir = join(repoRoot, "packages", "mewkit", "src", "migrate", "modules");

/** Required strategy-brief fields, mirrored from `StrategyBriefSchema`'s non-defaulted keys. */
const REQUIRED_BRIEF_FIELDS = [
	"situation",
	"decisionRecommendation",
	"nextFalsifiableCheck",
	"escalationPoint",
	"confidence",
] as const;

interface Plane {
	/** Display name used in test titles. */
	name: string;
	/** The agent adapter: the file a runtime actually loads to become Athena. */
	adapter: string;
	/** The canonical contract projection the adapter defers to on that plane. */
	contract: string;
	/** The path the adapter must cite, as an installed project would resolve it. */
	contractRef: string;
	/** How a skill id is spelled on this plane (`mk:cook` vs `mk-cook`). */
	skillId: (canonical: string) => string;
}

const PLANES: Plane[] = [
	{
		name: "claude",
		adapter: join(repoRoot, ".claude", "agents", "athena.md"),
		contract: join(repoRoot, ".claude", "rules-conditional", "advice-supervision-rules.md"),
		contractRef: ".claude/rules-conditional/advice-supervision-rules.md",
		skillId: (c) => c,
	},
	{
		name: "codex",
		adapter: join(modulesDir, "codex", "root", ".codex", "agents", "athena.toml"),
		contract: join(modulesDir, "codex", "root", ".agents", "skills", "rule-advice-supervision", "SKILL.md"),
		contractRef: ".agents/skills/rule-advice-supervision/SKILL.md",
		skillId: (c) => c.replace(":", "-"),
	},
	{
		name: "cursor",
		adapter: join(modulesDir, "cursor", "root", ".cursor", "agents", "athena.md"),
		contract: join(modulesDir, "cursor", "root", ".cursor", "rules", "domain-advice-supervision.mdc"),
		contractRef: ".cursor/rules/domain-advice-supervision.mdc",
		skillId: (c) => c.replace(":", "-"),
	},
];

const read = (p: string): string => readFileSync(p, "utf-8");

describe("athena provider parity: every plane ships an adapter and a contract", () => {
	for (const plane of PLANES) {
		it(`${plane.name}: adapter and contract both exist`, () => {
			expect(existsSync(plane.adapter), `missing adapter: ${plane.adapter}`).toBe(true);
			expect(existsSync(plane.contract), `missing contract: ${plane.contract}`).toBe(true);
		});

		it(`${plane.name}: adapter cites its own plane's contract path, not another plane's`, () => {
			// A filename match would pass on any plane (three files, one named SKILL.md). The
			// installed-project PATH is what a runtime actually resolves, so that is the check:
			// an adapter citing another plane's path sends the runtime to a file that is not
			// there.
			const body = read(plane.adapter);
			expect(body, `${plane.name} adapter does not cite ${plane.contractRef}`).toContain(plane.contractRef);
			for (const other of PLANES.filter((p) => p.name !== plane.name)) {
				expect(body, `${plane.name} adapter cites ${other.name}'s contract path`).not.toContain(
					other.contractRef,
				);
			}
		});
	}
});

describe("athena provider parity: the four stages and their legal dispositions", () => {
	for (const plane of PLANES) {
		const body = read(plane.adapter);

		it(`${plane.name}: names all four supervision stages`, () => {
			const missing = SUPERVISION_STAGES.filter((s) => !body.includes(s));
			expect(missing, `stages absent from ${plane.name} adapter: ${missing.join(", ")}`).toEqual([]);
		});

		for (const stage of SUPERVISION_STAGES) {
			it(`${plane.name}: lists every disposition legal at ${stage}`, () => {
				const missing = legalDispositions(stage).filter((d) => !body.includes(d));
				expect(missing, `${stage} dispositions absent from ${plane.name}: ${missing.join(", ")}`).toEqual([]);
			});
		}

		it(`${plane.name}: says READY_FOR_EXISTING_GATE does not clear the gate`, () => {
			// The single most load-bearing sentence in the contract: the one disposition that
			// sounds like an approval, explicitly denied as one.
			expect(body).toMatch(/READY_FOR_EXISTING_GATE[\s\S]{0,400}?(does \*\*not\*\* mean|never\*\* means|not mean the gate is cleared)/);
		});
	}
});

describe("athena provider parity: per-skill caps match the enforced table", () => {
	for (const plane of PLANES) {
		const contract = read(plane.contract);

		for (const [canonical, cap] of Object.entries(SKILL_HARD_CAPS)) {
			it(`${plane.name}: ${canonical} cap is ${cap}`, () => {
				const id = plane.skillId(canonical);
				expect(contract, `${id} absent from ${plane.name} contract`).toContain(id);
				// The cap sits in the same table row as the skill id.
				const row = contract.split("\n").find((l) => l.includes(id) && /\|/.test(l));
				expect(row, `no cap row for ${id} on ${plane.name}`).toBeTruthy();
				expect(row as string, `${id} row on ${plane.name} does not carry cap ${cap}`).toContain(String(cap));
			});
		}
	}
});

describe("athena provider parity: the direct-consult brief", () => {
	for (const plane of PLANES) {
		const body = read(plane.adapter);

		it(`${plane.name}: adapter documents every required brief field`, () => {
			const missing = REQUIRED_BRIEF_FIELDS.filter((f) => !body.includes(f));
			expect(missing, `required brief fields absent from ${plane.name}: ${missing.join(", ")}`).toEqual([]);
		});

		it(`${plane.name}: adapter refuses a disposition in consult mode`, () => {
			// A brief carrying a disposition claims a governed decision no run ever governed.
			// Every plane must say so in its own words; the token is what a reader greps for.
			expect(body).toMatch(/[Ff]orbidden in this mode|refused, not quietly dropped|refused, not stripped/);
			expect(body).toContain("disposition");
		});

		it(`${plane.name}: contract lists the refused brief fields the schema rejects`, () => {
			const contract = read(plane.contract);
			// The schema refuses more aliases than prose should enumerate; assert the ones a
			// reader would actually reach for. `supervisionRunId` and the receipt aliases are
			// covered by the schema alone.
			const load = FORBIDDEN_BRIEF_FIELDS.filter((f) =>
				["disposition", "requiredCorrections", "runId", "stage", "checkpointId", "strategicDirective"].includes(f),
			);
			const missing = load.filter((f) => !contract.includes(f));
			expect(missing, `refused brief fields absent from ${plane.name} contract: ${missing.join(", ")}`).toEqual([]);
		});
	}
});

describe("athena provider parity: no plane claims gate authority", () => {
	for (const plane of PLANES) {
		it(`${plane.name}: adapter carries no automated gate-approval claim`, () => {
			const rel = plane.adapter.slice(repoRoot.length + 1);
			expect(scanForGateAuthority(repoRoot, rel)).toEqual([]);
		});

		it(`${plane.name}: contract carries no automated gate-approval claim`, () => {
			const rel = plane.contract.slice(repoRoot.length + 1);
			expect(scanForGateAuthority(repoRoot, rel)).toEqual([]);
		});

		it(`${plane.name}: adapter states supervision is not verification`, () => {
			expect(read(plane.adapter)).toMatch(/not\*{0,2} verification|never\*{0,2} verification/i);
		});

		it(`${plane.name}: adapter does not change the executor's model`, () => {
			expect(read(plane.adapter)).toMatch(/supervises the workflow, not the model/);
		});
	}
});

describe("athena provider parity: the superseded fix-only contract is gone", () => {
	// Phase 1 superseded "one-shot counsel for mk:fix only". A bundle still carrying that
	// vocabulary ships the contract this redesign replaced.
	const RETIRED = [
		{ label: "one-shot framing", re: /one question, one packet, one turn/i },
		{ label: "retired disposition vocabulary", re: /proceed, pause, or escalate/i },
		{ label: "fix-only caller claim", re: /Currently that is (the fix skill|`?mk[-:]fix`?)/i },
		{ label: "no-second-round framing", re: /there is no second round|no persistence, no resumption/i },
	];

	for (const plane of PLANES) {
		for (const { label, re } of RETIRED) {
			it(`${plane.name}: adapter carries no ${label}`, () => {
				expect(re.test(read(plane.adapter)), `${plane.name} adapter still carries ${label}`).toBe(false);
			});
		}
	}
});

describe("athena provider parity: structural safety is per-plane, never equalized", () => {
	it("claude: the adapter grants read-only tools and nothing else", () => {
		const fm = read(PLANES[0].adapter).split("---")[1] ?? "";
		const tools = (fm.match(/^tools:\s*(.+)$/m)?.[1] ?? "").split(",").map((t) => t.trim());
		expect(tools.slice().sort()).toEqual(["Glob", "Grep", "Read"]);
	});

	it("cursor: the adapter is declared readonly", () => {
		expect(read(PLANES[2].adapter)).toMatch(/^readonly:\s*true$/m);
	});

	it("codex: the adapter discloses a behavioral ban rather than claiming a structural one", () => {
		const body = read(PLANES[1].adapter);
		expect(body).toMatch(/no\s+per-agent tool or permission field/);
		expect(body).toMatch(/behavioral/i);
		// The failure this guards: quietly upgrading the claim to match the other planes.
		expect(body).not.toMatch(/structurally read-only|readonly:\s*true/i);
	});

	it("every plane still states the behavioral half of the no-mutation rule", () => {
		for (const plane of PLANES) {
			expect(read(plane.adapter), `${plane.name} adapter`).toMatch(/No mutation|no-mutation/i);
		}
	});
});

describe("athena provider parity: an authored bundle carries no Claude-host token", () => {
	it("codex: adapter and contract are denied-token clean", () => {
		for (const p of [PLANES[1].adapter, PLANES[1].contract]) {
			const hits = scanDeniedTokens(read(p)).map((h) => h.label);
			expect(hits, `${p}: ${hits.join(", ")}`).toEqual([]);
		}
	});

	it("cursor: adapter and contract are denied-token clean", () => {
		for (const p of [PLANES[2].adapter, PLANES[2].contract]) {
			const hits = scanCursorDenied(read(p));
			expect(hits, `${p}: ${hits.join(", ")}`).toEqual([]);
		}
	});

	it("neither bundle adapter is a byte copy of the Claude one", () => {
		const claude = read(PLANES[0].adapter);
		expect(read(PLANES[1].adapter)).not.toBe(claude);
		expect(read(PLANES[2].adapter)).not.toBe(claude);
	});
});

describe("athena provider parity: declared support states are honest", () => {
	const STATES = ["supported", "degraded", "unverified", "unavailable"];

	for (const provider of ["codex", "cursor"]) {
		const coverage = JSON.parse(read(join(modulesDir, provider, "compliance", "capability-coverage.json")));
		const block = coverage.adviceSupervision;

		it(`${provider}: declares an adviceSupervision block with both capabilities`, () => {
			expect(block, `${provider} has no adviceSupervision block`).toBeTruthy();
			expect(block.stateEnum).toEqual(STATES);
			const names = (block.capabilities as { capability: string }[]).map((c) => c.capability).sort();
			// Direct consult and embedded supervision are separate capabilities (locked
			// decision 9): reporting one through the other's state is the impersonation the
			// contract exists to prevent.
			expect(names).toEqual(["direct-consult", "embedded-supervision"]);
		});

		it(`${provider}: no capability claims support without a live smoke`, () => {
			for (const c of block.capabilities as { capability: string; state: string; evidence: string }[]) {
				expect(STATES, `${c.capability} state`).toContain(c.state);
				// Structural evidence can never carry a `supported` claim — that is locked
				// decision 6, and it is the whole reason these states exist.
				if (c.evidence === "structural") expect(c.state).not.toBe("supported");
			}
		});

		it(`${provider}: the adapter and contract it names are the files that exist`, () => {
			expect(existsSync(join(modulesDir, provider, block.adapter))).toBe(true);
			expect(existsSync(join(modulesDir, provider, block.contract))).toBe(true);
		});

		it(`${provider}: the mutation ban's declared enforcement matches the adapter`, () => {
			expect(["structural", "behavioral"]).toContain(block.mutationBan.enforcement);
			expect(STATES).toContain(block.mutationBan.state);
			// Codex has no per-agent tool field, so `structural` there would be a false claim.
			expect(block.mutationBan.enforcement).toBe(provider === "codex" ? "behavioral" : "structural");
		});
	}
});

describe("athena provider parity: the codex contract projection installs", () => {
	it("rule-advice-supervision belongs to a pack (an unpackaged skill never installs)", () => {
		const catalog = JSON.parse(read(join(modulesDir, "codex", "catalog", "skill-packs.json")));
		const owning = Object.entries(catalog.packs as Record<string, { skills: string[] }>).filter(([, v]) =>
			v.skills.includes("rule-advice-supervision"),
		);
		expect(owning.map(([k]) => k)).toEqual([catalog.defaultPack]);
	});

	it("the contract is a rule projection, not an invocable workflow", () => {
		const body = read(PLANES[1].contract);
		expect(body).toMatch(/Not a workflow/i);
		expect(body).toMatch(/loads \*\*on demand\*\*|load only when --advice is present/i);
	});
});

describe("athena provider parity: neither bundle turns the flag on yet", () => {
	// Slice A authors the adapter; wrapper wiring is a separate change. Until then the
	// honest state is the documented fallback line, not a half-wired checkpoint.
	for (const plane of PLANES.slice(1)) {
		it(`${plane.name}: the contract states no wrapper is wired and names the fallback line`, () => {
			const body = read(plane.contract);
			expect(body).toMatch(/No skill on this runtime is wired yet/);
			expect(body).toContain("advice checkpoint unavailable in this runtime");
		});
	}
});
