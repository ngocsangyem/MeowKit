import fs from "node:fs";
import path from "node:path";
import type { ImpactMap } from "../../review/impact-map.js";
import { buildRoster } from "../../review/roster.js";
import type { EvidenceEvent, EvidenceLevel } from "../../review/schema.js";

// `mewkit review coverage --session <id>` — compare the REQUIRED roster (rebuilt
// deterministically from impact-map.json, never a persisted/editable roster) against
// session-observed evidence. Exits non-zero with a machine-readable gap list when
// required coverage is missing. Reports evidence_level (session-observed vs attested);
// Phase 6 caps Approve/Gate-2 on attested (this command does not gate on level).
//
// HONESTY INVARIANT: evidence.jsonl and hook-evidence.jsonl are session-dir files the
// acting session can write. `session-observed` proves the corroboration was recorded,
// NOT that it is unforgeable — it is anti-accidental, not tamper-proof, and never
// establishes independent-reviewer provenance (phase-04-capability-spike). Gate 2
// stays a human decision; this signal is evidence a human reads, not authority.

// Canonicalize a read target so CLI (relative-normalized) and hook (raw command
// token) representations of the same file corroborate: drop a leading "./" and any
// trailing slash. Fail-safe either way (a mismatch only ever downgrades to attested).
const normTarget = (t: unknown): string => String(t ?? "").replace(/^\.\//, "").replace(/\/+$/, "");

export interface CoverageGap {
	type: "reviewer-never-launched" | "brief-never-read" | "diff-never-opened" | "required-read-missing";
	reviewer: string;
	target?: string;
}

export interface CoverageReport {
	ok: boolean;
	session: string;
	evidenceLevel: EvidenceLevel;
	complete: boolean;
	approveEligible: boolean; // complete AND session-observed
	gaps: CoverageGap[];
	error?: string;
}

export interface CoverageOptions {
	session: string;
	cwd?: string;
	json?: boolean;
	// When called as a sub-step (e.g. by compose), suppress all console output and the
	// process.exitCode side effect so the caller owns its own I/O and exit semantics.
	silent?: boolean;
}

function readJsonl(file: string): EvidenceEvent[] {
	if (!fs.existsSync(file)) return [];
	return fs
		.readFileSync(file, "utf-8")
		.split("\n")
		.filter(Boolean)
		.flatMap((line) => {
			try { return [JSON.parse(line) as EvidenceEvent]; } catch { return []; }
		});
}

export async function reviewCoverage(options: CoverageOptions): Promise<CoverageReport> {
	const cwd = options.cwd ?? process.cwd();
	const sessionDir = path.join(cwd, "tasks", "reviews", options.session);
	const emit = (r: CoverageReport): CoverageReport => {
		if (options.silent) return r;
		if (options.json) console.log(JSON.stringify(r, null, 2));
		else if (r.error) console.error(`✗ ${r.error}`);
		else console.log(`${r.complete ? "✓" : "✗"} coverage ${r.complete ? "complete" : "INCOMPLETE"} · level=${r.evidenceLevel} · ${r.gaps.length} gap(s)`);
		if (!r.complete) process.exitCode = 1;
		return r;
	};
	const bail = (error: string): CoverageReport =>
		emit({ ok: false, session: options.session, evidenceLevel: "attested", complete: false, approveEligible: false, gaps: [], error });

	const impactPath = path.join(sessionDir, "impact-map.json");
	if (!fs.existsSync(impactPath)) return bail(`no impact-map.json in ${path.relative(cwd, sessionDir)} (run 'mewkit review prepare' first)`);
	let impact: ImpactMap;
	try { impact = JSON.parse(fs.readFileSync(impactPath, "utf-8")); } catch (e) { return bail(`cannot read impact-map.json: ${(e as Error).message}`); }

	// Defensive defaults so a pre-Phase-5 impact map (no stats/changedFiles) still
	// yields a roster (selects the small tier) rather than crashing.
	if (!impact.stats) impact.stats = { sourceChanged: 0, totalChanged: 0 };
	if (!impact.changedFiles) impact.changedFiles = [];
	// Always recompute the tier from the persisted impact.stats — the same input
	// `prepare` used — so coverage checks the SAME roster reviewers actually received.
	// No tier override: a mismatched override would gate against the wrong roster.
	const roster = buildRoster(impact);
	const cli = readJsonl(path.join(sessionDir, "evidence.jsonl")).filter((e) => e.source !== "hook");
	const hook = readJsonl(path.join(sessionDir, "hook-evidence.jsonl"));
	const hookTargets = new Set(hook.filter((e) => e.kind === "read").map((e) => normTarget(e.target)));

	const gaps: CoverageGap[] = [];
	const requiredReads: string[] = [];
	for (const entry of roster.entries) {
		const mine = cli.filter((e) => e.reviewer === entry.id && e.kind === "read");
		if (mine.length === 0) {
			gaps.push({ type: "reviewer-never-launched", reviewer: entry.id });
			continue;
		}
		const readTargets = new Set(mine.map((e) => e.target));
		for (const target of entry.expectedReads) {
			requiredReads.push(target);
			if (!readTargets.has(target)) {
				const type: CoverageGap["type"] = target === "diff.patch" ? "diff-never-opened" : target.startsWith("briefs/") ? "brief-never-read" : "required-read-missing";
				gaps.push({ type, reviewer: entry.id, target });
			}
		}
	}

	// Evidence level: session-observed only when every required read that WAS performed
	// via the CLI is corroborated by a hook-tagged event (driving-session Bash). Any
	// missing corroboration → attested (Phase 6 caps Approve).
	const performedRequired = cli.filter((e) => e.kind === "read" && requiredReads.includes(String(e.target)));
	const allCorroborated = performedRequired.length > 0 && performedRequired.every((e) => hookTargets.has(normTarget(e.target)));
	const evidenceLevel: EvidenceLevel = allCorroborated ? "session-observed" : "attested";

	const complete = gaps.length === 0;
	return emit({ ok: complete, session: options.session, evidenceLevel, complete, approveEligible: complete && evidenceLevel === "session-observed", gaps });
}
