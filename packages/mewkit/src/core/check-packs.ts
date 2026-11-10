// Static `validate --packs` coherence + safety check. Proves the pack manifest is
// internally consistent (resolvable profiles, real override ids, resolvable
// depends_on), that every governed artifact belongs to ≥1 pack or base, and — the
// non-negotiable safety invariant — that base carries the full gate/privacy/dispatch
// chain at its exact verified paths. Mirrors checkOwnership's quad-state pattern.
import { ALWAYS_ON_RULE_PATHS } from "./always-on-rules.js";
import { buildInventory } from "./build-inventory.js";
import {
	availablePacks,
	availableProfiles,
	BASE_PACK,
	flattenProfile,
	hasPackManifest,
	loadPackManifest,
} from "./pack-manifest.js";
import { resolvePacksDetailed } from "./pack-resolver.js";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "../commands/doctor-checks.js";

/**
 * Safety surface that MUST resolve into `base` for every profile — the three write
 * guards and their gate libraries listed below, the dispatch chain, the completion gate,
 * settings, statusline, and the always-on rules. Paths are exact (note
 * `hooks/lib/...`); a missing one makes a profile shippable without enforcement,
 * so each absence is a hard FAIL.
 *
 * The three entrypoint paths were command files until the kit stopped shipping a
 * command surface; they were renamed to the skill and reference that absorbed each
 * job rather than dropped, because the invariant is "every profile can reach these
 * jobs", not "these three files exist".
 *
 * Two entries were removed when the shell runtime went away, both because the
 * thing they named no longer exists rather than because enforcement shrank:
 * `hooks/lib/read-hook-input.sh` was replaced by `hooks/lib/parse-stdin.cjs`,
 * which is already listed, and `hooks/lib/load-dotenv.sh` is no longer on any
 * guard's path — the dotenv is read by one integration handler, so its port is
 * an integration library, not a safety surface.
 */
export const SAFETY_PATHS = [
	"statusline.cjs",
	"settings.json",
	"hooks/gate-enforcement.cjs",
	"hooks/privacy-block.cjs",
	"hooks/pre-ship.cjs",
	"hooks/handlers/pre-completion-check.cjs",
	"hooks/dispatch.cjs",
	"hooks/lib/parse-stdin.cjs",
	"hooks/lib/shared-state.cjs",
	"hooks/handlers.json",
	"hooks/lib/gate2-check.cjs",
	"hooks/lib/approval-receipt.cjs",
	"hooks/lib/validate-contract.cjs",
	"hooks/lib/check-contract-signed.cjs",
	"hooks/lib/validate-gate-2.cjs",
	...ALWAYS_ON_RULE_PATHS,
	// Essential cross-profile entrypoints. Each names the surface that now owns a job
	// the kit used to expose as its own slash command: planning, the self-update path,
	// and deterministic validation. A profile missing one of these has no way to reach
	// that job at all, which is why they sit in the safety list rather than in a pack.
	"skills/plan-creator/SKILL.md",
	"skills/help/references/cli.md",
	"skills/lint-and-validate/SKILL.md",
];

const PASS = (name: string, detail: string): CheckResult => ({ name, status: "pass", detail, section: "Packs" });
const FAIL = (name: string, detail: string): CheckResult => ({ name, status: "fail", detail, section: "Packs" });

export function checkPacks(claudeDir: string, opts: { missingInfraSeverity?: Status } = {}): CheckResult[] {
	// Manifest absent ⇒ pack modularization not installed. Default run downgrades to
	// WARN (prompt upgrade); scoped `--packs` keeps it a hard FAIL for CI.
	if (!hasPackManifest(claudeDir)) {
		const status: Status = opts.missingInfraSeverity ?? "fail";
		return [
			{
				name: "Pack manifest installed",
				status,
				detail:
					status === "warn"
						? "No pack-manifest.json — pack modularization not installed; run `mewkit upgrade`"
						: "Missing pack-manifest.json (.meowkit/, or .claude/ on a pre-move install)",
				section: "Packs",
			},
		];
	}

	let manifest;
	try {
		manifest = loadPackManifest(claudeDir);
	} catch (err) {
		return [FAIL("Pack manifest loads", (err as Error).message)];
	}

	const results: CheckResult[] = [];

	// 1. Every profile flattens without an unknown ref or cycle.
	for (const profile of availableProfiles(manifest)) {
		try {
			flattenProfile(manifest, profile);
		} catch (err) {
			results.push(FAIL(`Profile resolves: ${profile}`, (err as Error).message));
		}
	}

	const inv = buildInventory(claudeDir);
	const invIds = new Set(inv.entries.map((e) => e.id));

	// 2. Every artifactsAdd/Exclude id is a real artifact (catches phantom ids).
	for (const [packName, def] of Object.entries(manifest.packs)) {
		for (const id of [...(def.artifactsAdd ?? []), ...(def.artifactsExclude ?? [])]) {
			if (!invIds.has(id)) {
				results.push(FAIL(`Pack override id: ${packName}`, `references unknown artifact id "${id}"`));
			}
		}
	}

	// 3. Completeness: every governed artifact belongs to ≥1 pack OR base.
	const coveredOwners = new Set<string>();
	const coveredAddIds = new Set<string>();
	for (const def of Object.values(manifest.packs)) {
		for (const o of def.owners ?? []) coveredOwners.add(o);
		for (const id of def.artifactsAdd ?? []) coveredAddIds.add(id);
	}
	let baseSet: Set<string>;
	try {
		baseSet = resolvePacksDetailed(claudeDir, manifest, []).packMembership.get(BASE_PACK) ?? new Set();
	} catch (err) {
		return [...results, FAIL("Base resolves", (err as Error).message)];
	}
	const strays = inv.entries.filter(
		(e) => !coveredOwners.has(e.owner) && !coveredAddIds.has(e.id) && !baseSet.has(e.path),
	);
	if (strays.length > 0) {
		results.push(
			FAIL(
				"Pack completeness",
				`${strays.length} artifact(s) in no pack/base: ${strays
					.slice(0, 8)
					.map((e) => `${e.id}(${e.owner || "no-owner"})`)
					.join(", ")}`,
			),
		);
	}

	// 4. Safety invariant: base carries every gate/privacy/dispatch path.
	const missingSafety = SAFETY_PATHS.filter((p) => !baseSet.has(p));
	if (missingSafety.length > 0) {
		results.push(FAIL("Base safety invariant", `base missing required safety file(s): ${missingSafety.join(", ")}`));
	}

	// 5. depends_on resolvability + the empty-edges advisory.
	let anyEdges = false;
	for (const e of inv.entries) {
		for (const dep of e.dependsOn ?? []) {
			anyEdges = true;
			if (!invIds.has(dep)) {
				results.push(FAIL(`depends_on: ${e.id}`, `unresolvable dependency "${dep}"`));
			}
		}
	}
	if (!anyEdges && inv.entries.length > 0) {
		results.push({
			name: "depends_on edges",
			status: "warn",
			detail: `inventory has ${inv.entries.length} artifacts but no depends_on edges — closure is inert (future-proofing only)`,
			section: "Packs",
		});
	}

	const failed = results.filter((r) => r.status === "fail").length;
	results.push(
		failed === 0
			? PASS(
					"Pack coherence",
					`${availableProfiles(manifest).length} profiles, ${availablePacks(manifest).length} packs, ${inv.entries.length} artifacts — 100% covered`,
				)
			: FAIL("Pack coherence", `${failed} pack defect(s)`),
	);
	return results;
}
